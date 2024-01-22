import {
  SchemaRoot,
  extractQueryArgs,
  getReferencedObject,
} from "./floro-generator-schema-api";

export async function getJSON<T>(
  state: SchemaRoot,
): Promise<T> {
  const themes = getReferencedObject(state, "$(theme).themes");
  const themeColors = getReferencedObject(state, "$(theme).themeColors");
  const themesObject = {
    themeDefinitions: {},
    themeColors: {},
  };
  for (const theme of themes) {
    themesObject.themeDefinitions[theme.id] = {
      name: theme.id,
      background: theme.backgroundColor?.hexcode + 'FF',
    };
  }
  for (const themeColor of themeColors) {
    themesObject.themeColors[themeColor.id] = {
      default: {},
      variants: {},
    };
    for (const themeDef of themeColor.themeDefinitions) {
      const [themeId] = extractQueryArgs(themeDef.id);
      const paletteColor = getReferencedObject(
        state,
        themeDef.paletteColorShade
      );
      if (paletteColor?.hexcode) {
        const color = `${paletteColor?.hexcode}${(themeDef?.alpha ?? 255)
          .toString(16)
          .toUpperCase()
          .padStart(2, "0")}`;
        themesObject.themeColors[themeColor.id].default[themeId] = color;
      } else {
        themesObject.themeColors[themeColor.id].default[themeId] = null;
      }
    }
    if (themeColor.includeVariants) {
      for (const themeVariant of themeColor.variants) {
        const [variantId] = extractQueryArgs(themeVariant.id);
        themesObject.themeColors[themeColor.id].variants[variantId] = {};
        for (const variantDefintion of themeVariant.variantDefinitions) {
          const [themeId] = extractQueryArgs(variantDefintion.id);
          const paletteColor = getReferencedObject(
            state,
            variantDefintion.paletteColorShade
          );
          if (paletteColor?.hexcode) {
            const color = `${paletteColor?.hexcode}${(
              variantDefintion?.alpha ?? 255
            )
              .toString(16)
              .toUpperCase()
              .padStart(2, "0")}`;
            themesObject.themeColors[themeColor.id].variants[variantId][
              themeId
            ] = color;
          } else {
            themesObject.themeColors[themeColor.id].variants[variantId][
              themeId
            ] = null;
          }
        }
      }
    }
  }
  return themesObject as T;
}