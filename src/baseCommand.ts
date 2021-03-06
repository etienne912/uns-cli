import { Command, flags } from "@oclif/command";
import Config from "@oclif/config";
import { FlagInvalidOptionError } from "@oclif/parser/lib/errors";
import { Managers, Types, Utils, Identities } from "@uns/ark-crypto";
import { ChainMeta, Network, Transaction, Wallet, ResponseWithChainMeta, DIDType, DIDHelpers } from "@uns/ts-sdk";
import { cli } from "cli-ux";
import { UnikInfos, CryptoAccountPassphrases } from "types";
import { Formater, getFormatFlag, OUTPUT_FORMAT } from "./formater";
import * as LOGGER from "./logger";
import { UnsClientWrapper } from "./sdkWrapper";
import * as UTILS from "./utils";
import {
    getWalletFromPassphrase,
    isDid,
    checkPassphraseFormat,
    getSecondPassphraseFromUser,
    getPassphraseFromUser,
} from "./utils";
import { isTokenId, resolveUnikName } from "./utils";
import { HttpNotFoundError } from "./errorHandler";

export abstract class BaseCommand extends Command {
    public static baseFlags = {
        help: flags.help({ char: "h" }),
        network: flags.string({
            char: "n",
            description: "Network used to create UNIK nft token",
            default: "livenet",
            options: UTILS.getNetworksList(),
            env: "UNS_NETWORK",
        }),
        verbose: flags.boolean({
            char: "v",
            description: "Detailed logs",
        }),
        node: flags.string({
            description: "URL of custom node representing blockchain endpoint",
            env: "UNS_NODE",
        }),
        nftfactory: flags.string({
            description: "URL of custom UNS service provider",
            env: "UNS_SERVICES",
        }),
    };

    public unsClientWrapper: UnsClientWrapper;

    protected verbose: boolean = false;

    private formater: Formater | undefined;

    constructor(argv: any[], config: Config.IConfig) {
        super(argv, config);
        this.unsClientWrapper = new UnsClientWrapper(config);
    }

    public async init() {
        // Add dynamic format flag
        Object.assign(this.getCommand().flags, getFormatFlag(this.getDefaultFormat(), this.getAvailableFormats()));
        await super.init();
    }

    public async run() {
        let flags;
        let args;

        try {
            const parserResult = this.parse(this.getCommand());
            flags = parserResult.flags;
            args = parserResult.args;
        } catch (e) {
            if (e?.oclif?.exit === 0) {
                // In case of --help flag, this.exit throws exception during flags parse
                // Just exit normally after help display
                this.exit(0);
            }

            let errorMsg;

            if (e.parse && !e.args) {
                errorMsg = e.message;
            } else {
                errorMsg = `Command fail because of unexpected value for at least one parameter${
                    e.args ? ` (${e.args.map((arg: any) => (arg.name ? arg.name : arg)).join(", ")})` : ""
                }. Please check your parameters.`;
            }

            this.stop(errorMsg);
            this.exit(2);
        }

        // Set formater
        this.formater = OUTPUT_FORMAT[flags.format];
        this.verbose = flags.verbose;

        if (this.verbose) {
            LOGGER.bindConsole();
        } else {
            LOGGER.disableLogs(this);
        }

        /**
         * Configuration
         */

        await this.setupNetwork(flags);

        if (UTILS.isDevMode()) {
            this.info("DEV MODE IS ACTIVATED");
        }
        try {
            this.info(`node: ${this.unsClientWrapper.getCurrentNode()}`);
            const commandResult = await this.do(flags, args);
            if (commandResult && typeof commandResult === "string") {
                super.log(commandResult);
            } else {
                if (commandResult && Object.keys(commandResult).length > 0) {
                    // Keep super.log to force log
                    super.log(
                        this.formater && this.formater.action ? this.formater.action(commandResult) : commandResult,
                    );
                }
            }
        } catch (globalCatchException) {
            this.stop(globalCatchException.message);
            if (this.verbose) {
                this.stop(globalCatchException.stack);
            }
            this.exit(1);
        }
    }

    public info(message: string, ...args: any[]): void {
        if (this.verbose || this._helpOverride()) {
            LOGGER.logWithLevel("info", message, ...args);
        }
    }

    public warn(message: string, ...args: any[]): void {
        LOGGER.logWithLevel("warn", message, ...args);
    }

    /**
     * Always log and exit
     * @param message
     * @param args
     */
    public stop(message: string, ...args: any[]): void {
        LOGGER.logWithLevel("stop", message, ...args);
    }

    public actionStart(msg: string) {
        if (this.verbose) {
            cli.action.start(msg);
        }
    }

    public actionStop() {
        if (this.verbose) {
            cli.action.stop();
        }
    }

    /**
     * Check transaction api util retrieved transaction has {expectedConfirmations} confirmations during {retry} block times maximum
     * @param blockTime
     * @param transactionId
     * @param numberOfRetry
     * @param expectedConfirmations
     */
    public async waitTransactionConfirmations(
        blockTime: number,
        transactionId: string,
        numberOfRetry: number = 0,
        expectedConfirmations: number = 0,
    ): Promise<(Transaction & { chainmeta: ChainMeta }) | undefined> {
        const transactionFromNetwork = await this.unsClientWrapper.getTransaction(transactionId, blockTime * 1000);
        const confirmations = transactionFromNetwork?.confirmations ? transactionFromNetwork.confirmations : 0;
        if (confirmations < expectedConfirmations && numberOfRetry > 0) {
            return await this.waitTransactionConfirmations(
                blockTime,
                transactionId,
                numberOfRetry - 1,
                expectedConfirmations,
            );
        }
        return transactionFromNetwork;
    }

    public isFlagSet(flagName: string, flagChar?: string): boolean {
        return this.argv.some(
            (arg) =>
                arg === `--${flagName}` ||
                arg.startsWith(`--${flagName}=`) ||
                (flagChar && (arg === `-${flagChar}` || arg.startsWith(`-${flagChar}=`))),
        );
    }

    public async targetResolve(flags: Record<string, any>, target: string): Promise<UnikInfos> {
        let ownerAddress: string;
        let unikid: string;
        let chainmeta: ChainMeta;
        let transactions;

        if (isTokenId(target)) {
            unikid = target;
            const unikInfos = await this.unsClientWrapper.getUnikById(unikid);
            ownerAddress = unikInfos.ownerId;
            chainmeta = unikInfos.chainmeta;
            transactions = unikInfos.transactions;
        } else if (isDid(target)) {
            const resolved = await resolveUnikName(target, flags);
            if (resolved.error) {
                throw resolved.error;
            }
            unikid = resolved?.data.unikid;
            ownerAddress = resolved?.data.ownerAddress;
            chainmeta = resolved?.chainmeta as ChainMeta;
        } else {
            throw new Error(`Unik target argument does not match expected format.`);
        }

        return { unikid, ownerAddress, chainmeta, transactions };
    }

    protected async withAction<T>(actionDescription: string, callback: () => any): Promise<T> {
        this.actionStart(actionDescription);
        try {
            return await callback();
        } catch (e) {
            this.debug(e);
            throw e;
        } finally {
            this.actionStop();
        }
    }

    protected debug = (...args: any[]): void => {
        if (this.verbose || this._helpOverride()) {
            LOGGER.logWithLevel("debug", "", ...args);
        }
    };

    protected getAvailableFormats(): Formater[] {
        return [OUTPUT_FORMAT.json];
    }

    protected getDefaultFormat(): Formater {
        return OUTPUT_FORMAT.json;
    }
    protected abstract do(flags?: Record<string, any>, args?: Record<string, any>): Promise<any>;
    protected abstract getCommand(): typeof BaseCommand;

    protected logAttribute(label: string, value: string) {
        this.log(`\t${label}: ${value}`);
    }

    /**
     * Checks that all heights passed in parameter are equals
     * @param heights
     */
    protected checkDataConsistency(...heights: string[]) {
        if (!heights.every((v) => v === heights[0])) {
            throw new Error("Unable to read right now. Please retry.");
        }
    }

    protected async getNextWalletNonceFromPassphrase(passphrase: string): Promise<string> {
        const wallet = getWalletFromPassphrase(passphrase, this.unsClientWrapper.network);
        return Utils.BigNumber.make(await this.unsClientWrapper.getNonce(wallet.address))
            .plus(1)
            .toString();
    }

    private async setupNetwork(flags: { [x: string]: any }) {
        // This happen when providing network through env var
        // see Oclif PR: https://github.com/oclif/parser/pull/64
        // will be removed if PR is accepted
        if (!UTILS.getNetworksList().includes(flags.network)) {
            throw new FlagInvalidOptionError(BaseCommand.baseFlags.network, flags.network);
        }

        // UNS SDK
        const networkName: Types.NetworkName = flags.network;

        // UNS and Ark Crypto
        Managers.configManager.setFromPreset(networkName);
        this.unsClientWrapper.init(networkName as Network, flags.node, flags.nftfactory);

        const [configurationCrypto, height] = await Promise.all([
            this.unsClientWrapper.getConfigurationForCrypto(),
            this.unsClientWrapper.getCurrentHeight(),
        ]);

        Managers.configManager.setConfig(configurationCrypto);
        Managers.configManager.setHeight(height);
    }

    /**
     * Get wallet with recipientId, apply predicate and returns result
     * @param recipientId
     * @param predicate
     */
    public async applyWalletPredicate(recipientId: string, predicate: (wallet: Wallet) => boolean) {
        try {
            const wallet: Wallet & { chainmeta: ChainMeta } = await this.unsClientWrapper.getWallet(recipientId);
            return predicate(wallet);
        } catch (e) {
            if (e instanceof HttpNotFoundError) {
                this.info(`Wallet ${recipientId} not found.`);
                return false;
            }
            throw e;
        }
    }

    /**
     * Return true if a second wallet passphrase is needed
     */
    public async hasSecondPassphrase(passphrase: string): Promise<boolean> {
        const cryptoAccountAddress: string = Identities.Address.fromPassphrase(passphrase);
        return this.applyWalletPredicate(cryptoAccountAddress, (wallet) => wallet && !!wallet.secondPublicKey);
    }

    public async askForPassphrases(
        flags: Record<string, any>,
        checkSecondPassphrase = true,
    ): Promise<CryptoAccountPassphrases> {
        let passphrase: string = flags.passphrase;
        let secondPassphrase: string = flags["second-passphrase"];

        if (!passphrase) {
            passphrase = await getPassphraseFromUser();
        }
        checkPassphraseFormat(passphrase);

        if (checkSecondPassphrase) {
            if (!secondPassphrase && (await this.hasSecondPassphrase(passphrase))) {
                secondPassphrase = await getSecondPassphraseFromUser();
            }
            if (secondPassphrase) {
                checkPassphraseFormat(secondPassphrase);
            }
        }

        return { first: passphrase, second: secondPassphrase };
    }

    /**
     * Return the UNID of this service provider depending on command flags
     */
    public getServiceProviderUNID(flags: Record<string, any>): string {
        const urlCheckers: string[] = Managers.configManager.getMilestone().urlCheckers || [];
        if (flags.type === "url" && urlCheckers.length) {
            return urlCheckers[0]; // The 1st is official Unikname URL Checker
        }
        return this.unsClientWrapper.network.forgeFactory.unikidWhiteList[0];
    }

    public async getUnikType(unikId: string): Promise<DIDType> {
        // get unik type
        const unikTypeResponse: ResponseWithChainMeta<string> = (await this.unsClientWrapper.getUnikProperty(
            unikId,
            "type",
            false,
        )) as ResponseWithChainMeta<string>;
        let unikType: string;

        if (unikTypeResponse.error) {
            throw new Error(`Unable to get UNIK type (id: ${unikId}). Caused by ${unikTypeResponse.error?.message}`);
        } else {
            unikType = unikTypeResponse.data as string;
        }

        const type: number = Number.parseInt(unikType);

        const didType = DIDHelpers.fromCode(type);

        if (!didType) {
            throw new Error("Unknown UNIK type");
        }

        return didType;
    }
}
