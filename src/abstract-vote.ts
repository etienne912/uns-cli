import { Interfaces } from "@uns/ark-crypto";
import { Unik, Wallet } from "@uns/ts-sdk";
import { NestedCommandOutput } from "./formater";
import { CryptoAccountPassphrases, WithChainmeta } from "./types";
import { checkUnikIdFormat, createVoteTransaction, getUniknameWalletAddress } from "./utils";
import { WriteCommand } from "./writeCommand";

export abstract class AbstractDelegateVoteCreateCommand extends WriteCommand {
    public static flags = {
        ...AbstractDelegateVoteCreateCommand.getFlags(),
    };

    protected static getFlags() {
        const flags = WriteCommand.flags;
        delete flags.senderAccount;
        return flags;
    }

    protected abstract getVotes(delegatePublicKey: string): string[];

    protected async do(flags: Record<string, any>, args: Record<string, any>): Promise<NestedCommandOutput> {
        const delegateId: string = args.id;

        // Get Delegate public key
        const delegatePublicKey: string = await this.resolveDelegateWalletPublicKey(delegateId);

        const passphrases: CryptoAccountPassphrases = await this.askForPassphrases(flags);

        /**
         * Read emitter's wallet nonce
         */
        const nonce = await this.getNextWalletNonceFromPassphrase(passphrases.first);

        /**
         * Transaction creation
         */
        this.actionStart("Creating transaction");
        const transactionStruct: Interfaces.ITransactionData = await createVoteTransaction(
            this.getVotes(delegatePublicKey),
            flags.fee,
            nonce,
            passphrases.first,
            passphrases.second,
        );
        this.actionStop();

        if (!transactionStruct.id) {
            throw new Error("Transaction id can't be undefined");
        }

        const transactionFromNetwork = await this.sendAndWaitConfirmationsIfNeeded(transactionStruct, flags);

        if (!transactionFromNetwork) {
            const transactionUrl = `${this.unsClientWrapper.getExplorerUrl()}/transaction/${transactionStruct.id}`;
            this.error(
                `Transaction not found yet, the network can be slow. Check this url in a while: ${transactionUrl}`,
            );
        }

        return {
            data: {
                transaction: transactionStruct.id,
                confirmations: transactionFromNetwork ? transactionFromNetwork.confirmations : 0,
            },
        };
    }

    private async resolveDelegateWalletPublicKey(delegateId: string): Promise<string> {
        let walletAddress: string;

        if (delegateId && delegateId.startsWith("@")) {
            walletAddress = await getUniknameWalletAddress(delegateId, this.unsClientWrapper.unsClient);
        } else {
            checkUnikIdFormat(delegateId);
            const unik: Unik = await this.unsClientWrapper.getUnikById(delegateId);
            walletAddress = unik.ownerId;
        }

        const wallet: WithChainmeta<Wallet> = await this.unsClientWrapper.getWallet(walletAddress);
        if (!wallet) {
            throw new Error("Delegate not found");
        }

        if (!wallet.isDelegate) {
            throw new Error("This Unikname is not registered as delegate.");
        }

        return wallet.publicKey;
    }
}
