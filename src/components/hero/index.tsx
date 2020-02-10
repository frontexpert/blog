import Image from 'gatsby-image';
import React from 'react';

import { IBlogPostFrontmatter } from '../../templates/blog-post';

import styles from './styles.module.css';

interface IFluidObject {
  aspectRatio: number;
  src: string;
  srcSet: string;
  sizes: string;
  base64?: string;
  tracedSVG?: string;
  srcWebp?: string;
  srcSetWebp?: string;
  presentationWidth?: number;
}

interface IGatsbyImageProps {
  sizes?: IFluidObject;
  fluid?: IFluidObject;
  picture?: IFluidObject;
  fadeIn?: boolean;
  title?: string;
  alt?: string;
  className?: string | object;
  critical?: boolean;
  style?: object;
  imgStyle?: object;
  placeholderStyle?: object;
  backgroundColor?: string | boolean;
  onLoad?: () => void;
  onStartLoad?: (param: { wasCached: boolean }) => void;
  onError?: (event: any) => void;
  Tag?: string;
}

import { MAX_WIDTH_HERO_IMAGE } from '../../../plugins/config/constants';

function NonStretchedImage(props: IGatsbyImageProps) {
  const presetantionWidth = props.fluid?.presentationWidth;
  const width =
    presetantionWidth < MAX_WIDTH_HERO_IMAGE
      ? presetantionWidth / 2
      : presetantionWidth;
  let normalizedProps = props;
  if (props.fluid && props.fluid.presentationWidth) {
    normalizedProps = {
      ...props,
      style: {
        ...(props.style || {}),
        maxWidth: width,
        margin: '0 auto'
      }
    };
  }
  return <Image {...normalizedProps} />;
}

function Hero({ pictureComment, picture }: IBlogPostFrontmatter) {
  return (
    <div className={styles.pictureWrapper}>
      <div className={styles.picture}>
        <NonStretchedImage fluid={picture?.childImageSharp.fluid} />
      </div>
      {pictureComment && (
        <div className={styles.pictureComment}>{pictureComment}</div>
      )}
    </div>
  );
}

export default Hero;
