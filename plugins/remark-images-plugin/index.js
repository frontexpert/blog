'use strict';

var _interopRequireDefault = require('@babel/runtime/helpers/interopRequireDefault');
var _regenerator = _interopRequireDefault(
  require('@babel/runtime/regenerator')
);
var _require = require('./constants'),
  DEFAULT_OPTIONS = _require.DEFAULT_OPTIONS,
  imageClass = _require.imageClass,
  imageBackgroundClass = _require.imageBackgroundClass,
  imageWrapperClass = _require.imageWrapperClass,
  maxWidth = _require.DEFAULT_OPTIONS.maxWidth;

var visitWithParents = require('unist-util-visit-parents');
var getDefinitions = require('mdast-util-definitions');
var path = require('path');
var queryString = require('query-string');
var isRelativeUrl = require('is-relative-url');
var _ = require('lodash');

var _require2 = require('gatsby-plugin-sharp'),
  fluid = _require2.fluid,
  stats = _require2.stats,
  traceSVG = _require2.traceSVG;

var Promise = require('bluebird');
var cheerio = require('cheerio');
var _require3 = require('gatsby-core-utils'),
  slash = _require3.slash;
var chalk = require('chalk');

module.exports = function(_ref, pluginOptions) {
  var files = _ref.files,
    markdownNode = _ref.markdownNode,
    markdownAST = _ref.markdownAST,
    pathPrefix = _ref.pathPrefix,
    getNode = _ref.getNode,
    reporter = _ref.reporter,
    cache = _ref.cache,
    compiler = _ref.compiler;

  var options = _.defaults(
    pluginOptions,
    {
      pathPrefix: pathPrefix
    },
    DEFAULT_OPTIONS
  );

  var findParentLinks = function findParentLinks(_ref2) {
    var children = _ref2.children;
    return children.some(function(node) {
      return (
        (node.type === 'html' && !!node.value.match(/<a /)) ||
        node.type === 'link'
      );
    });
  }; // Get all the available definitions in the markdown tree

  var definitions = getDefinitions(markdownAST); // This will allow the use of html image tags
  // const rawHtmlNodes = select(markdownAST, `html`)

  var rawHtmlNodes = [];
  visitWithParents(markdownAST, ['html', 'jsx'], function(node, ancestors) {
    var inLink = ancestors.some(findParentLinks);
    rawHtmlNodes.push({
      node: node,
      inLink: inLink
    });
  }); // This will only work for markdown syntax image tags

  var markdownImageNodes = [];
  visitWithParents(markdownAST, ['image', 'imageReference'], function(
    node,
    ancestors
  ) {
    var inLink = ancestors.some(findParentLinks);
    markdownImageNodes.push({
      node: node,
      inLink: inLink
    });
  });

  var getImageInfo = function getImageInfo(uri) {
    var _queryString$parseUrl = queryString.parseUrl(uri),
      url = _queryString$parseUrl.url,
      query = _queryString$parseUrl.query;

    return {
      ext: path
        .extname(url)
        .split('.')
        .pop(),
      url: url,
      query: query
    };
  };

  var getImageCaption = function getImageCaption(node, overWrites) {
    var getCaptionString = function getCaptionString() {
      var captionOptions = Array.isArray(options.showCaptions)
        ? options.showCaptions
        : options.showCaptions === true
        ? ['title', 'alt']
        : false;

      if (captionOptions) {
        for (
          var _iterator = captionOptions,
            _isArray = Array.isArray(_iterator),
            _i = 0,
            _iterator = _isArray ? _iterator : _iterator[Symbol.iterator]();
          ;

        ) {
          var _ref3;

          if (_isArray) {
            if (_i >= _iterator.length) break;
            _ref3 = _iterator[_i++];
          } else {
            _i = _iterator.next();
            if (_i.done) break;
            _ref3 = _i.value;
          }

          var option = _ref3;

          switch (option) {
            case 'title':
              if (node.title) {
                return node.title;
              }

              break;

            case 'alt':
              if (overWrites.alt) {
                return overWrites.alt;
              }

              if (node.alt) {
                return node.alt;
              }

              break;
          }
        }
      }

      return '';
    };

    var captionString = getCaptionString();

    if (!options.markdownCaptions || !compiler) {
      return _.escape(captionString);
    }

    return compiler.generateHTML(compiler.parseString(captionString));
  }; // Takes a node and generates the needed images and then returns
  // the needed HTML replacement for the image

  var generateImagesAndUpdateNode = function generateImagesAndUpdateNode(
    node,
    resolve,
    inLink,
    overWrites
  ) {
    var parentNode,
      imagePath,
      imageNode,
      fluidResult,
      originalImg,
      fallbackSrc,
      srcSet,
      presentationWidth,
      srcSplit,
      fileName,
      fileNameNoExt,
      defaultAlt,
      alt,
      title,
      loading,
      imageStyle,
      imageTag,
      webpFluidResult,
      placeholderImageData,
      args,
      _require4,
      Potrace,
      argsKeys,
      tracedSVG,
      ratio,
      wrapperStyle,
      imageCaption,
      removeBgImage,
      imageStats,
      bgImage,
      rawHTML,
      height,
      width;

    return _regenerator.default.async(function generateImagesAndUpdateNode$(
      _context
    ) {
      while (1) {
        switch ((_context.prev = _context.next)) {
          case 0:
            if (overWrites === void 0) {
              overWrites = {};
            }

            // Check if this markdownNode has a File parent. This plugin
            // won't work if the image isn't hosted locally.
            parentNode = getNode(markdownNode.parent);

            if (!(parentNode && parentNode.dir)) {
              _context.next = 6;
              break;
            }

            imagePath = slash(
              path.join(parentNode.dir, getImageInfo(node.url).url)
            );
            _context.next = 7;
            break;

          case 6:
            return _context.abrupt('return', null);

          case 7:
            imageNode = _.find(files, function(file) {
              if (file && file.absolutePath) {
                return file.absolutePath === imagePath;
              }

              return null;
            });

            if (!(!imageNode || !imageNode.absolutePath)) {
              _context.next = 10;
              break;
            }

            return _context.abrupt('return', resolve());

          case 10:
            _context.next = 12;
            return _regenerator.default.awrap(
              fluid({
                file: imageNode,
                args: options,
                reporter: reporter,
                cache: cache
              })
            );

          case 12:
            fluidResult = _context.sent;

            if (fluidResult) {
              _context.next = 15;
              break;
            }

            return _context.abrupt('return', resolve());

          case 15:
            originalImg = fluidResult.originalImg;
            fallbackSrc = fluidResult.src;
            srcSet = fluidResult.srcSet;
            presentationWidth = fluidResult.presentationWidth; // Generate default alt tag

            srcSplit = getImageInfo(node.url).url.split('/');
            fileName = srcSplit[srcSplit.length - 1];
            fileNameNoExt = fileName.replace(/\.[^/.]+$/, '');
            defaultAlt = fileNameNoExt.replace(/[^A-Z0-9]/gi, ' ');
            alt = _.escape(
              overWrites.alt ? overWrites.alt : node.alt ? node.alt : defaultAlt
            );
            var temp_imageCaption =
              options.showCaptions && getImageCaption(node, overWrites);
            title = node.title ? _.escape(node.title) : alt;
            var size = title.split('=').length > 1 ? title.split('=')[1] : '';
            title = title.split('=')[0].trim();
            width = size ? size.split('x')[0].trim() + 'px' : '100%';
            height =
              size.split('x').length > 1
                ? size.split('x')[1].trim() + 'px'
                : '100%';
            loading = options.loading;

            if (!['lazy', 'eager', 'auto'].includes(loading)) {
              reporter.warn(
                reporter.stripIndent(
                  '\n        ' +
                    chalk.bold(loading) +
                    ' is an invalid value for the ' +
                    chalk.bold('loading') +
                    ' option. Please pass one of "lazy", "eager" or "auto".\n      '
                )
              );
            }

            imageStyle = (
              '\n      width: ' +
              width +
              ';\n      height: ' +
              height +
              ';\n      margin: 0;\n      vertical-align: middle;'
            ).replace(/\s*(\S+:)\s*/g, '$1'); // Create our base image tag

            imageTag = (
              '\n      <img\n        class="' +
              imageClass +
              '"\n        alt="' +
              alt +
              '"\n        title="' +
              title +
              '"\n        src="' +
              fallbackSrc +
              '"\n        srcset="' +
              srcSet +
              '"\n        sizes="' +
              fluidResult.sizes +
              '"\n        style="' +
              imageStyle +
              '"\n        loading="' +
              loading +
              '"\n      />\n    '
            ).trim(); // if options.withWebp is enabled, generate a webp version and change the image tag to a picture tag

            if (!options.withWebp) {
              _context.next = 36;
              break;
            }

            _context.next = 32;
            return _regenerator.default.awrap(
              fluid({
                file: imageNode,
                args: _.defaults(
                  {
                    toFormat: 'WEBP'
                  }, // override options if it's an object, otherwise just pass through defaults
                  options.withWebp === true ? {} : options.withWebp,
                  pluginOptions,
                  DEFAULT_OPTIONS
                ),
                reporter: reporter
              })
            );

          case 32:
            webpFluidResult = _context.sent;

            if (webpFluidResult) {
              _context.next = 35;
              break;
            }

            return _context.abrupt('return', resolve());

          case 35:
            imageTag = (
              '\n      <picture>\n        <source\n          srcset="' +
              webpFluidResult.srcSet +
              '"\n          sizes="' +
              webpFluidResult.sizes +
              '"\n          type="' +
              webpFluidResult.srcSetType +
              '"\n        />\n        <source\n          srcset="' +
              srcSet +
              '"\n          sizes="' +
              fluidResult.sizes +
              '"\n          type="' +
              fluidResult.srcSetType +
              '"\n        />\n        <img\n          class="' +
              imageClass +
              '"\n          src="' +
              fallbackSrc +
              '"\n          alt="' +
              alt +
              '"\n          title="' +
              title +
              '"\n          loading="' +
              loading +
              '"\n          style="' +
              imageStyle +
              '"\n        />\n      </picture>\n      '
            ).trim();

          case 36:
            placeholderImageData = fluidResult.base64; // if options.tracedSVG is enabled generate the traced SVG and use that as the placeholder image

            if (!options.tracedSVG) {
              _context.next = 46;
              break;
            }

            args =
              typeof options.tracedSVG === 'object' ? options.tracedSVG : {}; // Translate Potrace constants (e.g. TURNPOLICY_LEFT, COLOR_AUTO) to the values Potrace expects

            (_require4 = require('potrace')), (Potrace = _require4.Potrace);
            argsKeys = Object.keys(args);
            args = argsKeys.reduce(function(result, key) {
              var value = args[key];
              result[key] = Potrace.hasOwnProperty(value)
                ? Potrace[value]
                : value;
              return result;
            }, {});
            _context.next = 44;
            return _regenerator.default.awrap(
              traceSVG({
                file: imageNode,
                args: args,
                fileArgs: args,
                cache: cache,
                reporter: reporter
              })
            );

          case 44:
            tracedSVG = _context.sent;
            // Escape single quotes so the SVG data can be used in inline style attribute with single quotes
            placeholderImageData = tracedSVG.replace(/'/g, "\\'");

          case 46:
            ratio = (1 / fluidResult.aspectRatio) * 100 + '%';
            if (width !== '100%') {
              var width$ =
                parseInt(width.split('px')[0]) < maxWidth
                  ? parseInt(width.split('px')[0])
                  : maxWidth;
              ratio =
                height === '100%'
                  ? (1 / fluidResult.aspectRatio) * width$ + 'px'
                  : height;
            }
            wrapperStyle =
              typeof options.wrapperStyle === 'function'
                ? options.wrapperStyle(fluidResult)
                : options.wrapperStyle; // Construct new image node w/ aspect ratio placeholder

            imageCaption =
              options.showCaptions && getImageCaption(node, overWrites);
            removeBgImage = false;

            if (!options.disableBgImageOnAlpha) {
              _context.next = 55;
              break;
            }

            _context.next = 53;
            return _regenerator.default.awrap(
              stats({
                file: imageNode,
                reporter: reporter
              })
            );

          case 53:
            imageStats = _context.sent;
            if (imageStats && imageStats.isTransparent) removeBgImage = true;

          case 55:
            if (options.disableBgImage) {
              removeBgImage = true;
            }

            bgImage = removeBgImage
              ? ''
              : " background-image: url('" +
                placeholderImageData +
                "'); background-size: cover; background-repeat: round;";
            rawHTML = (
              '\n  <span\n    class="' +
              imageBackgroundClass +
              '"\n    style="padding-bottom: ' +
              ratio +
              '; width: ' +
              width +
              '; position: relative; bottom: 0; left: 0;' +
              bgImage +
              ' display: block;"\n  ></span>\n  ' +
              imageTag +
              '\n  '
            ).trim(); // Make linking to original image optional.

            if (!inLink && options.linkImagesToOriginal) {
              rawHTML = (
                '\n  <a\n    class="gatsby-resp-image-link"\n    href="' +
                originalImg +
                '"\n    target="_blank"\n    rel="noopener"\n  >\n    ' +
                rawHTML +
                '\n  </a>\n    '
              ).trim();
            }

            rawHTML = (
              '\n    <span\n      class="' +
              imageWrapperClass +
              '"\n      style="position: relative; display: block; margin-left: auto; margin-right: auto; ' +
              (imageCaption ? '' : wrapperStyle) +
              ' max-width: ' +
              presentationWidth +
              'px;"\n    >\n      ' +
              rawHTML +
              '\n    </span>\n    '
            ).trim(); // Wrap in figure and use title as caption

            if (imageCaption) {
              rawHTML = (
                '\n  <figure class="gatsby-resp-image-figure" style="' +
                wrapperStyle +
                '">\n    ' +
                rawHTML +
                '\n    <figcaption class="gatsby-resp-image-figcaption">' +
                imageCaption +
                '</figcaption>\n  </figure>\n      '
              ).trim();
            }

            return _context.abrupt('return', rawHTML);

          case 62:
          case 'end':
            return _context.stop();
        }
      }
    });
  };

  return Promise.all(
    // Simple because there is no nesting in markdown
    markdownImageNodes.map(function(_ref4) {
      var node = _ref4.node,
        inLink = _ref4.inLink;
      return new Promise(function _callee(resolve, reject) {
        var overWrites, refNode, fileType, _rawHTML;

        return _regenerator.default.async(function _callee$(_context2) {
          while (1) {
            switch ((_context2.prev = _context2.next)) {
              case 0:
                overWrites = {};

                if (
                  !(
                    !node.hasOwnProperty('url') &&
                    node.hasOwnProperty('identifier')
                  )
                ) {
                  _context2.next = 7;
                  break;
                }

                //consider as imageReference node
                refNode = node;
                node = definitions(refNode.identifier); // pass original alt from referencing node

                overWrites.alt = refNode.alt;

                if (node) {
                  _context2.next = 7;
                  break;
                }

                return _context2.abrupt('return', resolve());

              case 7:
                fileType = getImageInfo(node.url).ext; // Ignore gifs as we can't process them,
                // svgs as they are already responsive by definition

                if (
                  !(
                    isRelativeUrl(node.url) &&
                    fileType !== 'gif' &&
                    fileType !== 'svg'
                  )
                ) {
                  _context2.next = 16;
                  break;
                }

                _context2.next = 11;
                return _regenerator.default.awrap(
                  generateImagesAndUpdateNode(node, resolve, inLink, overWrites)
                );

              case 11:
                _rawHTML = _context2.sent;

                if (_rawHTML) {
                  // Replace the image or ref node with an inline HTML node.
                  if (refNode) {
                    node = refNode;
                  }

                  node.type = 'html';
                  node.value = _rawHTML;
                }

                return _context2.abrupt('return', resolve(node));

              case 16:
                return _context2.abrupt('return', resolve());

              case 17:
              case 'end':
                return _context2.stop();
            }
          }
        });
      });
    })
  ).then(function(markdownImageNodes) {
    return (
      // HTML image node stuff
      Promise.all(
        // Complex because HTML nodes can contain multiple images
        rawHtmlNodes.map(function(_ref5) {
          var node = _ref5.node,
            inLink = _ref5.inLink;
          return new Promise(function _callee2(resolve, reject) {
            var $,
              imageRefs,
              _i2,
              _imageRefs,
              thisImg,
              formattedImgTag,
              _fileType,
              _rawHTML2;

            return _regenerator.default.async(function _callee2$(_context3) {
              while (1) {
                switch ((_context3.prev = _context3.next)) {
                  case 0:
                    if (node.value) {
                      _context3.next = 2;
                      break;
                    }

                    return _context3.abrupt('return', resolve());

                  case 2:
                    $ = cheerio.load(node.value);

                    if (!($('img').length === 0)) {
                      _context3.next = 5;
                      break;
                    }

                    return _context3.abrupt('return', resolve());

                  case 5:
                    imageRefs = [];
                    $('img').each(function() {
                      imageRefs.push($(this));
                    });
                    (_i2 = 0), (_imageRefs = imageRefs);

                  case 8:
                    if (!(_i2 < _imageRefs.length)) {
                      _context3.next = 29;
                      break;
                    }

                    thisImg = _imageRefs[_i2];
                    // Get the details we need.
                    formattedImgTag = {};
                    formattedImgTag.url = thisImg.attr('src');
                    formattedImgTag.title = thisImg.attr('title');
                    formattedImgTag.alt = thisImg.attr('alt');

                    if (formattedImgTag.url) {
                      _context3.next = 16;
                      break;
                    }

                    return _context3.abrupt('return', resolve());

                  case 16:
                    _fileType = getImageInfo(formattedImgTag.url).ext; // Ignore gifs as we can't process them,
                    // svgs as they are already responsive by definition

                    if (
                      !(
                        isRelativeUrl(formattedImgTag.url) &&
                        _fileType !== 'gif' &&
                        _fileType !== 'svg'
                      )
                    ) {
                      _context3.next = 26;
                      break;
                    }

                    _context3.next = 20;
                    return _regenerator.default.awrap(
                      generateImagesAndUpdateNode(
                        formattedImgTag,
                        resolve,
                        inLink
                      )
                    );

                  case 20:
                    _rawHTML2 = _context3.sent;

                    if (!_rawHTML2) {
                      _context3.next = 25;
                      break;
                    }

                    // Replace the image string
                    thisImg.replaceWith(_rawHTML2);
                    _context3.next = 26;
                    break;

                  case 25:
                    return _context3.abrupt('return', resolve());

                  case 26:
                    _i2++;
                    _context3.next = 8;
                    break;

                  case 29:
                    // Replace the image node with an inline HTML node.
                    node.type = 'html';
                    node.value = $('body').html(); // fix for cheerio v1

                    return _context3.abrupt('return', resolve(node));

                  case 32:
                  case 'end':
                    return _context3.stop();
                }
              }
            });
          });
        })
      ).then(function(htmlImageNodes) {
        return markdownImageNodes.concat(htmlImageNodes).filter(function(node) {
          return !!node;
        });
      })
    );
  });
};
