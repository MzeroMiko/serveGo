"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setBodyBackgroundToThemeBackgroundColor = exports.getNlsConfiguration = exports.nlsConfigElementId = void 0;
const util_1 = require("../../common/util");
require("../register");
const options = util_1.getOptions();
// TODO: Add proper types.
/* eslint-disable @typescript-eslint/no-explicit-any */
// NOTE@jsjoeio
// This lives here ../../../lib/vscode/src/vs/base/common/platform.ts#L106
exports.nlsConfigElementId = "vscode-remote-nls-configuration";
/**
 * A helper function to get the NLS Configuration settings.
 *
 * This is used by VSCode for localizations (i.e. changing
 * the display language).
 *
 * Make sure to wrap this in a try/catch block when you call it.
 **/
function getNlsConfiguration(document) {
    const errorMsgPrefix = "[vscode]";
    const nlsConfigElement = document?.getElementById(exports.nlsConfigElementId);
    const nlsConfig = nlsConfigElement?.getAttribute("data-settings");
    if (!document) {
        throw new Error(`${errorMsgPrefix} Could not parse NLS configuration. document is undefined.`);
    }
    if (!nlsConfigElement) {
        throw new Error(`${errorMsgPrefix} Could not parse NLS configuration. Could not find nlsConfigElement with id: ${exports.nlsConfigElementId}`);
    }
    if (!nlsConfig) {
        throw new Error(`${errorMsgPrefix} Could not parse NLS configuration. Found nlsConfigElement but missing data-settings attribute.`);
    }
    return JSON.parse(nlsConfig);
}
exports.getNlsConfiguration = getNlsConfiguration;
try {
    const nlsConfig = getNlsConfiguration(document);
    if (nlsConfig._resolvedLanguagePackCoreLocation) {
        const bundles = Object.create(null);
        nlsConfig.loadBundle = (bundle, _language, cb) => {
            const result = bundles[bundle];
            if (result) {
                return cb(undefined, result);
            }
            // FIXME: Only works if path separators are /.
            const path = nlsConfig._resolvedLanguagePackCoreLocation + "/" + bundle.replace(/\//g, "!") + ".nls.json";
            fetch(`${options.base}/vscode/resource/?path=${encodeURIComponent(path)}`)
                .then((response) => response.json())
                .then((json) => {
                bundles[bundle] = json;
                cb(undefined, json);
            })
                .catch(cb);
        };
    }
    ;
    self.require = {
        // Without the full URL VS Code will try to load file://.
        baseUrl: `${window.location.origin}${options.csStaticBase}/lib/vscode/out`,
        recordStats: true,
        // TODO: There don't appear to be any types for trustedTypes yet.
        trustedTypesPolicy: window.trustedTypes?.createPolicy("amdLoader", {
            createScriptURL(value) {
                if (value.startsWith(window.location.origin)) {
                    return value;
                }
                throw new Error(`Invalid script url: ${value}`);
            },
        }),
        paths: {
            "vscode-textmate": `../node_modules/vscode-textmate/release/main`,
            "vscode-oniguruma": `../node_modules/vscode-oniguruma/release/main`,
            xterm: `../node_modules/xterm/lib/xterm.js`,
            "xterm-addon-search": `../node_modules/xterm-addon-search/lib/xterm-addon-search.js`,
            "xterm-addon-unicode11": `../node_modules/xterm-addon-unicode11/lib/xterm-addon-unicode11.js`,
            "xterm-addon-webgl": `../node_modules/xterm-addon-webgl/lib/xterm-addon-webgl.js`,
            "tas-client-umd": `../node_modules/tas-client-umd/lib/tas-client-umd.js`,
            "iconv-lite-umd": `../node_modules/iconv-lite-umd/lib/iconv-lite-umd.js`,
            jschardet: `../node_modules/jschardet/dist/jschardet.min.js`,
        },
        "vs/nls": nlsConfig,
    };
}
catch (error) {
    console.error(error);
    /* Probably fine. */
}
function setBodyBackgroundToThemeBackgroundColor(document, localStorage) {
    const errorMsgPrefix = "[vscode]";
    if (!document) {
        throw new Error(`${errorMsgPrefix} Could not set body background to theme background color. Document is undefined.`);
    }
    if (!localStorage) {
        throw new Error(`${errorMsgPrefix} Could not set body background to theme background color. localStorage is undefined.`);
    }
    const colorThemeData = localStorage.getItem("colorThemeData");
    if (!colorThemeData) {
        throw new Error(`${errorMsgPrefix} Could not set body background to theme background color. Could not find colorThemeData in localStorage.`);
    }
    let _colorThemeData;
    try {
        // We wrap this JSON.parse logic in a try/catch
        // because it can throw if the JSON is invalid.
        // and instead of throwing a random error
        // we can throw our own error, which will be more helpful
        // to the end user.
        _colorThemeData = JSON.parse(colorThemeData);
    }
    catch {
        throw new Error(`${errorMsgPrefix} Could not set body background to theme background color. Could not parse colorThemeData from localStorage.`);
    }
    const hasColorMapProperty = Object.prototype.hasOwnProperty.call(_colorThemeData, "colorMap");
    if (!hasColorMapProperty) {
        throw new Error(`${errorMsgPrefix} Could not set body background to theme background color. colorThemeData is missing colorMap.`);
    }
    const editorBgColor = _colorThemeData.colorMap["editor.background"];
    if (!editorBgColor) {
        throw new Error(`${errorMsgPrefix} Could not set body background to theme background color. colorThemeData.colorMap["editor.background"] is undefined.`);
    }
    document.body.style.background = editorBgColor;
    return null;
}
exports.setBodyBackgroundToThemeBackgroundColor = setBodyBackgroundToThemeBackgroundColor;
try {
    setBodyBackgroundToThemeBackgroundColor(document, localStorage);
}
catch (error) {
    console.error("Something went wrong setting the body background to the theme background color.");
    console.error(error);
}
//# sourceMappingURL=vscode.js.map