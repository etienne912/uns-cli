import { BaseCommand } from "../../baseCommand";
import { Formater, OUTPUT_FORMAT } from "../../formater";
import { PropertiesUpdateCommand } from "../../updatePropertiesCommand";
import { getNetworksListListForDescription, isDevMode, propertyKeyFlag } from "../../utils";

export class PropertiesUnsetCommand extends PropertiesUpdateCommand {
    public static hidden = !isDevMode();

    public static description = "Unset properties of UNIK token.";

    public static examples = [
        `$ uns properties:unset --network ${getNetworksListListForDescription()} --unikid {unikId}
        -k prop1 -k prop2 --format {json|yaml} --verbose`,
    ];

    public static flags = {
        ...PropertiesUpdateCommand.getUpdateCommandFlags(),
        ...propertyKeyFlag("Key of the property to unset. (multiple occurrences)"),
    };

    protected getAvailableFormats(): Formater[] {
        return [OUTPUT_FORMAT.json, OUTPUT_FORMAT.yaml];
    }

    protected getCommand(): typeof BaseCommand {
        return PropertiesUnsetCommand;
    }

    protected getProperties(flags: Record<string, any>): { [_: string]: string } {
        const properties: { [_: string]: string } = {};

        flags.propertyKey.forEach((prop: string) => {
            // @ts-ignore
            properties[prop] = null; // Needs to be null!!
        });
        return properties;
    }
}
