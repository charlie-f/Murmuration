#!/bin/sh
# Builds build/Murmuration.app and build/Murmuration.saver (universal: Apple silicon and Intel).
#   ./build.sh        build both
#   ./build.sh dev    build with the Web Inspector enabled, then open the app
# Needs Xcode or the Command Line Tools. No other downloads.
# Signs for this Mac only (ad hoc) unless MURMURATION_SIGN names a signing identity.
set -eu
cd "$(dirname "$0")"

WEB=../web
VERSION=$(sed -n 's/^ *version: "\(.*\)",$/\1/p' "$WEB/app.js")  # APP.version, the one version number
[ -n "$VERSION" ] || { echo "Couldn't read APP.version from web/app.js"; exit 1; }
SIGN=${MURMURATION_SIGN:--}
FLAGS="-O -swift-version 5"
[ "${1:-}" = dev ] && FLAGS="$FLAGS -D DEV"

rm -rf build
mkdir -p build/obj

# compile <output> <extra swiftc flags...> -- <sources...>, once per architecture, then join them
compile() {
    out=$1; shift
    for arch in arm64 x86_64; do
        swiftc $FLAGS -target $arch-apple-macos13.0 -o build/obj/$(basename "$out").$arch "$@"
    done
    lipo -create -output "$out" build/obj/$(basename "$out").*
}

# bundle <path.app|.saver> <Info.plist>: folders, Info.plist and the web files
bundle() {
    mkdir -p "$1/Contents/MacOS" "$1/Contents/Resources"
    sed "s/VERSION/$VERSION/g" "$2" > "$1/Contents/Info.plist"
    plutil -lint -s "$1/Contents/Info.plist"
    rsync -a --no-links --exclude .DS_Store "$WEB/" "$1/Contents/Resources/web/"
}

APP=build/Murmuration.app
bundle $APP App/Info.plist
compile $APP/Contents/MacOS/Murmuration -module-name Murmuration Shared/WebHost.swift App/main.swift

SAVER=build/Murmuration.saver
bundle $SAVER Saver/Info.plist
compile $SAVER/Contents/MacOS/Murmuration -module-name MurmurationSaver -emit-executable -Xlinker -bundle \
    Shared/WebHost.swift Saver/SaverView.swift

rm -rf build/obj
codesign --force --options runtime --timestamp=none -s "$SIGN" $SAVER
codesign --force --options runtime --timestamp=none -s "$SIGN" $APP

echo "Built $APP and $SAVER (version $VERSION)"
echo "Double-click Murmuration.saver to install the screensaver; put Murmuration.app in Applications."
[ "${1:-}" = dev ] && open $APP
exit 0
