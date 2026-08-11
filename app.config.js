const appJson = require('./app.json');

// experiments.baseUrl ("/moves") exists purely so the GitHub Pages web
// export resolves asset/bundle URLs under the /moves subpath the site is
// served from - `npx expo export --platform web` in the deploy workflow.
// It has no meaning for a native binary, but Expo's native asset-embed step
// (the "Bundle React Native code and images" Xcode build phase) still
// prefixes its output directory with it when present, trying to mkdir a
// literal "moves" segment inside the .app bundle where an existing file of
// the same name already sits - ENOTDIR, archive fails. EAS Build sets
// EAS_BUILD_PLATFORM to "ios"/"android" for native builds (never set for
// the plain `expo export --platform web` the GH Actions workflow runs), so
// that's a reliable switch to drop baseUrl for native builds only.
const isNativeEasBuild = process.env.EAS_BUILD_PLATFORM === 'ios' || process.env.EAS_BUILD_PLATFORM === 'android';

module.exports = ({ config }) => {
  const expo = { ...appJson.expo, ...config };
  if (isNativeEasBuild) {
    const { experiments, ...rest } = expo;
    return { ...rest };
  }
  return expo;
};
