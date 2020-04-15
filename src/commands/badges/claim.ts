import { flags } from "@oclif/parser";
import { BaseCommand } from "../../baseCommand";
import { Formater, OUTPUT_FORMAT } from "../../formater";
import { PropertiesUpdateCommand } from "../../updatePropertiesCommand";

// const BADGE_PREFIX = "Badges/";

const badges: Record<string, any> = {};

export class BadgesClaimCommand extends PropertiesUpdateCommand {
    public static description = "Claim a Badge for a UNIK.";

    public static hidden = true;

    public static examples = ["$ uns badges:claim @bob --badge {badge name}"];

    public static flags = {
        ...PropertiesUpdateCommand.getUpdateCommandFlags(),
        badge: flags.string({
            description: `Badge name`,
            char: "b",
            required: true,
        }),
    };

    public static args = PropertiesUpdateCommand.getUpdateCommandArgs();

    protected getAvailableFormats(): Formater[] {
        return [OUTPUT_FORMAT.json, OUTPUT_FORMAT.yaml];
    }

    protected getCommand(): typeof BaseCommand {
        return BadgesClaimCommand;
    }

    protected async getProperties(flags: Record<string, any>, _: string): Promise<{ [_: string]: string }> {
        if (Object.keys(badges).includes(flags.badge)) {
            return { [badges[flags.badge].coreStr]: "true" };
        } else {
            throw new Error(`Unknown badge ${flags.badge}`);
        }
    }
}
