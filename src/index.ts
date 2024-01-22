import {
  SchemaRoot,
  extractQueryArgs,
  getReferencedObject,
} from "./floro-generator-schema-api";
//@ts-ignore
import floroGeneratorFile from "../floro/floro.generator.json" assert {type: "json"};
import {
  quicktype,
  InputData,
  JSONSchemaInput,
  TypeScriptTargetLanguage,
} from "quicktype-core";
import path from 'path';
import fs from 'fs';
import { getJSON } from "./get-json";
export { getJSON} from "./get-json";

type Languages = "typescript";

export function filename() {
  return __filename;
}

export function getFloroGenerator() {
  return floroGeneratorFile;
}

const GET_THEME_CODE =`
export const getThemeDefintion = <T extends keyof ThemeDefinitions>(
  themeDefintions: ThemeDefinitions,
  themeDefintionName: T
): ThemeDefinitions[T] => {
  return themeDefintions[themeDefintionName];
}

export const getThemeColor = <
  T extends keyof ThemeColors,
  U extends keyof ThemeSet,
  K extends keyof ThemeColors[T]["variants"]|"default"
>(
  themeColors: ThemeColors,
  themeName: U,
  themeColorKey: T,
  variant?: K
): string|null => {
  const themeColor = themeColors[themeColorKey];
  const defaultColor = themeColor.default[themeName];
  if (!variant || variant == "default") {
    return defaultColor;
  }
  return (
    themeColor.variants[variant as keyof typeof themeColor.variants][
      themeName
    ] ?? defaultColor
  );
};
`.trim();

export async function generate(
  state: SchemaRoot,
  outDir: string,
  args: {
    lang?: Languages;
  }  = { lang: 'typescript'}
) {
  const themes = getReferencedObject(state, "$(theme).themes");
  const themeColors = getReferencedObject(state, "$(theme).themeColors");
  const SCHEMA = {
    $schema: "http://json-schema.org/draft-06/schema#",
    $ref: "#/definitions/Themes",
    definitions: {
      Themes: {
        type: "object",
        properties: {
          themeDefinitions: {
            $ref: "#/definitions/ThemeDefinitions",
          },
          themeColors: {
            $ref: "#/definitions/ThemeColors",
          },
        },
        required: ["themeDefinitions", "themeColors"],
        additionalProperties: false,
      },
      ThemeSet: {
        type: "object",
        properties: {},
        required: [] as string[],
        additionalProperties: false,
      },
      ThemeDefinitions: {
        type: "object",
        properties: {},
        required: [] as string[],
        additionalProperties: false,
      },
      ThemeColors: {
        type: "object",
        properties: {},
        required: [] as string[],
        additionalProperties: false,
      },
    },
  };

  const requiredThemeSet: string[] = [];
  const requiredThemeDefs: string[] = [];
  for (const theme of themes) {
    SCHEMA.definitions.ThemeSet.properties[theme.id] = {
      type: ["string", "null"],
    };
    requiredThemeSet.push(theme.id);
    SCHEMA.definitions.ThemeDefinitions.properties[theme.id] = {
      type: "object",
      properties: {
        name: {
          type: "string"
        },
        background: {
          type: "string"
        },
      },
      required: ["name", "background"],
      additionalProperties: false,
    };
    requiredThemeSet.push(theme.id);
    requiredThemeDefs.push(theme.id);
  }
  SCHEMA.definitions.ThemeSet.required = requiredThemeSet;
  SCHEMA.definitions.ThemeDefinitions.required = requiredThemeDefs;

  const themeColorKeys: string[] = [];
  for (const themeColor of themeColors) {
      SCHEMA.definitions.ThemeColors.properties[themeColor.id] = {
        type: "object",
        additionalProperties: false,
        required: ["default", "variants"],
        properties: {
          default: {
            $ref: "#/definitions/ThemeSet",
          },
          variants: {
            type: "object",
            required: [] as string[],
            additionalProperties: false,
            properties: {},
          },
        },
      };

      const enabledVariantIds = themeColor?.includeVariants ? themeColor.variants
        .map((ev) => {
          return getReferencedObject(state, ev.id);
        })
        .map((s) => s.id) : [];
        for (const variantId of enabledVariantIds) {
          SCHEMA.definitions.ThemeColors.properties[
            themeColor.id
          ].properties.variants.properties[variantId] = {
            $ref: "#/definitions/ThemeSet",
          };
          SCHEMA.definitions.ThemeColors.properties[
            themeColor.id
          ].properties.variants.required.push(variantId);
        }
      themeColorKeys.push(themeColor.id);
  }
  SCHEMA.definitions.ThemeColors.required = themeColorKeys;
  const inputData = new InputData();
  const source = { name: "Themes", schema: JSON.stringify(SCHEMA) };
  await inputData.addSource(
    "schema",
    source,
    () => new JSONSchemaInput(undefined)
  );

  if (args.lang == "typescript") {
    const lang = new TypeScriptTargetLanguage();
    const runtimeTypecheck = lang.optionDefinitions.find(
      (option) => option.name == "runtime-typecheck"
    );
    if (runtimeTypecheck) {
      runtimeTypecheck.defaultValue = false;
    }
    const { lines } = await quicktype({ lang, inputData });
    const code = lines.join("\n");
    let tsCode =`import themesJSON from './themes.json';\n\n`;
    tsCode += code + '\n';
    tsCode += GET_THEME_CODE + '\n\n';
    tsCode += `export default themesJSON as Themes;`;
    const tsFile = path.join(outDir, 'index.ts');
    await fs.promises.writeFile(tsFile, tsCode, 'utf-8');

    const themesJson = await getJSON(state);
    const jsonFile = path.join(outDir, 'themes.json');
    await fs.promises.writeFile(jsonFile, JSON.stringify(themesJson, null, 2), 'utf-8');
  }
}