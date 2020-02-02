const visitWithParents = require(`unist-util-visit-parents`);
const getDefinitions = require(`mdast-util-definitions`);
const path = require(`path`);
const queryString = require(`query-string`);
const isRelativeUrl = require(`is-relative-url`);
const _ = require(`lodash`);
const { fluid } = require(`gatsby-plugin-sharp`);
const Promise = require(`bluebird`);
const cheerio = require(`cheerio`);
const { slash } = require(`gatsby-core-utils`);

const DEFAULT_OPTIONS = {
  maxWidth: 700,
  markdownCaptions: false,
  withWebp: true,
};

const getImageInfo = uri => {
  const { url, query } = queryString.parseUrl(uri);
  return {
    ext: path
      .extname(url)
      .split(`.`)
      .pop(),
    url,
    query
  };
};

const rawHTML = ({
  node,
  fluidResult,
  webpFluidResult,
  options,
  overWrites
}) => {
  // Generate default alt tag
  const srcSplit = getImageInfo(node.url).url.split(`/`);
  const fileName = srcSplit[srcSplit.length - 1];
  const fileNameNoExt = fileName.replace(/\.[^/.]+$/, ``);
  const defaultAlt = fileNameNoExt.replace(/[^A-Z0-9]/gi, ` `);

  const alt = _.escape(
    overWrites.alt ? overWrites.alt : node.alt ? node.alt : defaultAlt
  );

  const nodeTitle = node.title ? _.escape(node.title) : alt;

  let title = nodeTitle
    .trim()
    .replace(/=\d{2,4}x\d{2,4}|=\d{2,4}/gi, ' ')
    .trim();

  if (!title) {
    title = alt;
  }

  const resize = nodeTitle.trim().match(/=\d{2,4}x\d{2,4}|=\d{2,4}/gi);

  let width = null;
  let height = null;

  if (resize) {
    const [w, h] = resize[0].replace(/^(.)/g, '').split('x');
    width = w;
    height = h;
  }

  let ratio = `${(1 / fluidResult.aspectRatio) * 100}%`;

  if (width) {
    const maxWidth = width < options.maxWidth ? width : options.maxWidth;
    ratio =
      height < fluidResult.presentationHeight
        ? height + 'px'
        : (1 / fluidResult.aspectRatio) * maxWidth + 'px';
  }

  const imageWith = width < fluidResult.presentationWidth ? width + 'px' : '100%';
  const imageHeight = height < fluidResult.presentationHeight ? height + 'px' : '100%'

  return `
    <span
      class="gatsby-resp-image-wrapper"
      style="position: relative; display: block; margin-left: auto; margin-right: auto; max-width: ${fluidResult.presentationWidth}px;"
    >
      <a
        class="gatsby-resp-image-link"
        href="${fluidResult.originalImg}"
        style="display: block"
        target="_blank"
        rel="noopener"
      >
      <span
        class="gatsby-resp-image-background-image"
        style="width: ${width}px; padding-bottom: ${ratio}; background-image: url('${fluidResult.base64}'); background-size: cover; position: relative; bottom: 0; left: 0; display: block;"
      ></span>
        <picture>
          <source
            srcset="${webpFluidResult.srcSet}"
            sizes="${webpFluidResult.sizes}"
            type="${webpFluidResult.srcSetType}"
          />
          <source
            srcset="${fluidResult.srcSet}"
            sizes="${fluidResult.sizes}"
            type="${fluidResult.srcSetType}"
          />
          <img
            class="gatsby-resp-image-image"
            src="${fluidResult.fallbackSrc}"
            alt="${alt}"
            title="${title}"
            loading="lazy"
            style="width: ${imageWith}; height: ${imageHeight}; margin: 0; vertical-align: middle;"
          />
        </picture>
      </a>
    </span>
    `.trim();
}

module.exports = (
  { files, markdownNode, markdownAST, pathPrefix, getNode, reporter, cache },
  pluginOptions
) => {
  const options = _.defaults(pluginOptions, { pathPrefix }, DEFAULT_OPTIONS);

  // Get all the available definitions in the markdown tree
  const definitions = getDefinitions(markdownAST);

  // This will allow the use of html image tags
  // const rawHtmlNodes = select(markdownAST, `html`)
  let rawHtmlNodes = [];
  visitWithParents(markdownAST, `html`, node => {
    rawHtmlNodes.push(node);
  });

  // This will only work for markdown syntax image tags
  let markdownImageNodes = [];

  visitWithParents(markdownAST, [`image`, `imageReference`], node => {
    markdownImageNodes.push(node);
  });

  // Takes a node and generates the needed images and then returns
  // the needed HTML replacement for the image
  const generateImagesAndUpdateNode = async function (
    node,
    resolve,
    overWrites = {}
  ) {
    // Check if this markdownNode has a File parent. This plugin
    // won't work if the image isn't hosted locally.
    const parentNode = getNode(markdownNode.parent);

    let imagePath;

    if (parentNode && parentNode.dir) {
      imagePath = slash(path.join(parentNode.dir, getImageInfo(node.url).url));
    } else {
      return null;
    }

    const imageNode = _.find(files, file => {
      if (file && file.absolutePath) {
        return file.absolutePath === imagePath;
      }
      return null;
    });

    if (!imageNode || !imageNode.absolutePath) {
      return resolve();
    }

    const fluidResult = await fluid({
      file: imageNode,
      args: options,
      reporter,
      cache
    });

    if (!fluidResult) {
      return resolve();
    }

    const webpFluidResult = await fluid({
      file: imageNode,
      args: _.defaults(
        { toFormat: `WEBP` },
        // override options if it's an object, otherwise just pass through defaults
        {},
        pluginOptions,
        DEFAULT_OPTIONS
      ),
      reporter
    });

    return rawHTML({
      node,
      overWrites,
      fluidResult,
      webpFluidResult,
      options
    });
  };

  return Promise.all(
    // Simple because there is no nesting in markdown
    markdownImageNodes.map(
      node =>
        new Promise(async (resolve, reject) => {
          const overWrites = {};
          let refNode;
          if (
            !node.hasOwnProperty(`url`) &&
            node.hasOwnProperty(`identifier`)
          ) {
            //consider as imageReference node
            refNode = node;
            node = definitions(refNode.identifier);
            // pass original alt from referencing node
            overWrites.alt = refNode.alt;
            if (!node) {
              // no definition found for image reference,
              // so there's nothing for us to do.
              return resolve();
            }
          }
          const fileType = getImageInfo(node.url).ext;

          // Ignore gifs as we can't process them,
          // svgs as they are already responsive by definition
          if (
            isRelativeUrl(node.url) &&
            fileType !== `gif` &&
            fileType !== `svg`
          ) {
            const rawHTML = await generateImagesAndUpdateNode(
              node,
              resolve,
              overWrites
            );

            if (rawHTML) {
              // Replace the image or ref node with an inline HTML node.
              if (refNode) {
                node = refNode;
              }
              node.type = `html`;
              node.value = rawHTML;
            }
            return resolve(node);
          } else {
            // Image isn't relative so there's nothing for us to do.
            return resolve();
          }
        })
    )
  ).then(markdownImageNodes =>
    // HTML image node stuff
    Promise.all(
      // Complex because HTML nodes can contain multiple images
      rawHtmlNodes.map(
        node =>
          new Promise(async (resolve, reject) => {
            if (!node.value) {
              return resolve();
            }

            const $ = cheerio.load(node.value);
            if ($(`img`).length === 0) {
              // No img tags
              return resolve();
            }

            let imageRefs = [];
            $(`img`).each(function () {
              imageRefs.push($(this));
            });

            for (let thisImg of imageRefs) {
              // Get the details we need.
              let formattedImgTag = {};
              formattedImgTag.url = thisImg.attr(`src`);
              formattedImgTag.title = thisImg.attr(`title`);
              formattedImgTag.alt = thisImg.attr(`alt`);

              if (!formattedImgTag.url) {
                return resolve();
              }

              const fileType = getImageInfo(formattedImgTag.url).ext;

              // Ignore gifs as we can't process them,
              // svgs as they are already responsive by definition
              if (
                isRelativeUrl(formattedImgTag.url) &&
                fileType !== `gif` &&
                fileType !== `svg`
              ) {
                const rawHTML = await generateImagesAndUpdateNode(
                  formattedImgTag,
                  resolve
                );

                if (rawHTML) {
                  // Replace the image string
                  thisImg.replaceWith(rawHTML);
                } else {
                  return resolve();
                }
              }
            }

            // Replace the image node with an inline HTML node.
            node.type = `html`;
            node.value = $(`body`).html(); // fix for cheerio v1

            return resolve(node);
          })
      )
    ).then(htmlImageNodes =>
      markdownImageNodes.concat(htmlImageNodes).filter(node => !!node)
    )
  );
};
