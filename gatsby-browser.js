exports.onRouteUpdate = () => {
  const imageWrappers = document.querySelectorAll(`.gatsby-resp-image-wrapper`);

  // https://css-tricks.com/snippets/javascript/loop-queryselectorall-matches/
  // for cross-browser looping through NodeList without polyfills
  for (let i = 0; i < imageWrappers.length; i++) {
    const imageWrapper = imageWrappers[i];

    const backgroundElement = imageWrapper.querySelector(
      `.gatsby-resp-image-background-image`
    );
    const imageElement = imageWrapper.querySelector(`.gatsby-resp-image-image`);

    const onImageLoad = () => {
      backgroundElement.style.transition = `opacity 0.5s 0.5s`;
      imageElement.style.transition = `opacity 0.5s`;
      onImageComplete();
    };

    const onImageComplete = () => {
      backgroundElement.style.opacity = 0;
      imageElement.style.opacity = 1;
      imageElement.style.color = `inherit`;
      imageElement.style.boxShadow = `inset 0px 0px 0px 400px white`;
      imageElement.removeEventListener(`load`, onImageLoad);
      imageElement.removeEventListener(`error`, onImageComplete);
    };

    imageElement.style.opacity = 0;
    imageElement.addEventListener(`load`, onImageLoad);
    imageElement.addEventListener(`error`, onImageComplete);
    if (imageElement.complete) {
      onImageComplete();
    }
  }
};
