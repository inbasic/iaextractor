##Youtube Audio Extractor (iaextractor)
A pure JavaScript AAC extractor for FLV format.

###General information
To compile iaextractor project, following packages are required:
* [python](http://www.python.org/getit/)
* [nodejs](http://nodejs.org/)

Folders description:
* src: iaextractor source code
* compile: nodejs auto-compiler
* ../addon-sdk-*: latest version of [Mozilla addon-sdk](https://addons.mozilla.org/en-US/developers/builder).
* preview: screenshots
* template: bootstrap folder

###How to compile iaextractor
1. Open a new terminal in the root dir (directory contains src, addon-sdk-*, preview, and compile folders)
2. Run "node compile\install.js" to run iaextractor in a new Firefox profile. To make xpi run "node compile\install.js --xpi". For more options use "--help"

###How to try precompiled latest version
1. Select the right branch
2. Browse the src directory
3. Download the raw *.xpi file
4. Drag and drop it into Firefox

###iaextractor contains codes from the follwing projects
1. http://www.moitah.net/
2. https://github.com/fent/node-ytdl
3. https://github.com/josdejong/jsoneditoronline
