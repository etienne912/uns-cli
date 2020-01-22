import { AbstractDelegateVoteCreateCommand } from "../../abstract-vote";
import { BaseCommand } from "../../baseCommand";
import { getNetworksListListForDescription } from "../../utils";

export class DelegateVoteCreateCommand extends AbstractDelegateVoteCreateCommand {
    public static description = "Vote for a delegate with his Unikname or unikid";

    public static examples = [
        `$ uns delegate:vote --network ${getNetworksListListForDescription()} DELEGATE
        --format {json|yaml} --verbose`,
    ];

    public static flags = {
        ...AbstractDelegateVoteCreateCommand.flags,
    };

    public static args = [
        {
            name: "id",
            description: "The Unikname between double quote, or the unikid of the delegate to vote for.",
            required: true,
        },
    ];

    protected getCommand(): typeof BaseCommand {
        return DelegateVoteCreateCommand;
    }

    protected getVotes(delegatePublicKey: string): string[] {
        return [`+${delegatePublicKey}`];
    }
}