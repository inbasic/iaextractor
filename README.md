##Youtube Audio Extractor (iaextractor)
A pure JavaScript AAC extractor for FLV format.

###General information
To compile iaextractor project you need to have these softwares and libraries available:
* [python](http://www.python.org/getit/)
* [nodejs](http://nodejs.org/)
* [Mozilla addon-sdk](https://addons.mozilla.org/en-US/developers/builder)
  
Folders description:
* src: source code
* compile: nodejs compiler
* ../addon-sdk-*: latest version of [Mozilla addon-sdk](https://addons.mozilla.org/en-US/developers/builder).
* preview: screenshots
* template: bootstrap folder

  > By default, the addon-sdk folder is assumed to be one directory above the project. This can be modified using the ``--sdk`` parameter.

###How to compile this project
1. Open a new terminal in the root dir (directory contains src, preview, template, and compile folders)
2. Run ``npm install`` to acquire the necessary nodejs packages
3. Run ``node compile/install.js`` to run ignotifier in a new Firefox profile  
   To make the xpi run ``node compile/install.js --xpi``  
   For more options use ``node compile/install.js --help``  

###How to try precompiled latest version
1. Select the right branch
2. Browse the src directory
3. Download the raw *.xpi file
4. Drag and drop it into Firefox

###iaextractor contains codes from the following projects
1. http://www.moitah.net/
2. https://github.com/fent/node-ytdl
3. https://github.com/josdejong/jsoneditoronline
