import { flags } from "@oclif/parser";
import { networks } from "@uns/crypto";
import { Client, ITransactionData } from "@uns/crypto";
import cli from "cli-ux";
import { NETWORKS } from "./config";

export const isDevMode = () => {
    return process.env.DEV_MODE === "true";
};

const getDisableNetworkList = (): string[] => {
    const networkList = ["unitnet", "mainnet", "testnet"];
    if (!this.isDevMode()) {
        networkList.push("dalinet");
    }
    return networkList;
};

const DISABLED_NETWORK_LIST = getDisableNetworkList();

export const getNetworksList = (): string[] => {
    return [...Object.keys(networks).filter(network => !DISABLED_NETWORK_LIST.includes(network)), "local"];
};

export const getNetworksListListForDescription = () => {
    return `[${this.getNetworksList().join("|")}]`;
};

export const getNetwork = (network: string): any => {
    return NETWORKS[network];
};

/**
 * Create NFTMint transaction structure
 * @param client
 * @param tokenId
 * @param passphrase
 * @param networkVerion
 */
export const createNFTMintTransaction = (
    client: Client,
    tokenId: string,
    tokenType: string,
    fee: number,
    passphrase: string,
    networkVerion: number,
): ITransactionData => {
    return client
        .getBuilder()
        .nftMint(tokenId)
        .properties({ type: tokenType })
        .fee(fee)
        .network(networkVerion)
        .sign(passphrase)
        .getStruct();
};

/**
 * Create NFTTransfer transaction structure
 * @param client
 * @param tokenId
 * @param passphrase
 * @param networkVerion
 */
export const createNFTTransferTransaction = (
    client: Client,
    tokenId: string,
    recipient: string,
    fee: number,
    passphrase: string,
    networkVerion: number,
): ITransactionData => {
    return client
        .getBuilder()
        .nftTransfer(tokenId)
        .recipientId(recipient)
        .fee(fee)
        .network(networkVerion)
        .sign(passphrase)
        .getStruct();
};

/**
 * Create NFTUpdate transaction structure
 * @param client
 * @param tokenId
 * @param properties
 * @param fees
 * @param networkVerion
 * @param passphrase
 */
export const createNFTUpdateTransaction = (
    client: Client,
    tokenId: string,
    properties: { [_: string]: string },
    fees: number,
    networkVerion: number,
    passphrase: string,
): ITransactionData => {
    return client
        .getBuilder()
        .nftUpdate(tokenId)
        .properties(properties)
        .fee(fees)
        .network(networkVerion)
        .sign(passphrase)
        .getStruct();
};

export const checkUnikIdFormat = (unikid: string) => {
    const valid = unikid && unikid.length === 64;
    if (!valid) {
        throw new Error("Unikid parameter does not match expected format");
    }
};

export const checkUnikPropertyFormat = (propertyKey: string) => {
    const valid = propertyKey && propertyKey.match(/[a-zA-Z0-9]+/)[0] === propertyKey;
    if (!valid) {
        throw new Error(`Property ${propertyKey} does not match expected format`);
    }
};

export const checkPassphraseFormat = (passphrase: string) => {
    const valid = passphrase && passphrase.split(" ").length === 12;
    if (!valid) {
        throw new Error("Wrong pass phrase format");
    }
};

export const getPassphraseFromUser = (): Promise<string> => {
    return cli.prompt("Enter your wallet passphrase (12 words phrase)", { type: "mask" });
};

export const passphraseFlag = {
    passphrase: flags.string({
        description:
            "The passphrase of the owner of UNIK. If you do not enter a passphrase you will be prompted for it.",
    }),
};

export const awaitFlag = {
    await: flags.integer({
        description: `Number of blocks to wait to get confirmed for the success. Default to 3.
            0 for immediate return.
            Needs to be strictly greater than --confirmation flag`,
        default: 3,
    }),
};

export const confirmationsFlag = {
    confirmations: flags.integer({
        description:
            "Number of confirmations to wait to get confirmed for the success. Default to 1.\n\t Needs to be strictly lower than --await flag",
        default: 1,
    }),
};

export const feeFlag = (defaultFee: number = 100000000): { [_: string]: flags.IOptionFlag<number> } => {
    return {
        fee: flags.integer({
            description: `Specify a dynamic fee in satoUNS. Defaults to ${defaultFee} (100000000 satoUNS = 1 UNS).`,
            default: defaultFee,
        }),
    };
};

export const unikidFlag = (description?: string) => {
    return {
        unikid: flags.string({
            description,
            required: true,
        }),
    };
};

export const chainmetaFlag = {
    chainmeta: flags.boolean({
        description: "Retrieve chain meta datas",
        default: false,
    }),
};

export const confirmedFlag = {
    confirmed: flags.integer({
        default: 3,
        description: "Minimum number of confirmation since the last update of the UNIK required to return the value.",
    }),
};

export const propertyKeyFlag = (description: string, multiple: boolean = true) => {
    return {
        propertyKey: flags.string({
            char: "k",
            description,
            required: true,
            multiple,
        }),
    };
};
