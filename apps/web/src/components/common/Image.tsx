import type { DetailedHTMLProps, ImgHTMLAttributes } from "react";
import { forwardRef } from "react";

type FitOptions = "contain" | "cover";

interface ImageProps extends
  Omit<
    DetailedHTMLProps<ImgHTMLAttributes<HTMLImageElement>, HTMLImageElement>,
    "width" | "height"
  > {
  src: string;
  /** Improves Web Vitals (CLS|LCP) */
  width: number;
  /** Improves Web Vitals (CLS|LCP) */
  height?: number;
  /** Improves Web Vitals (LCP). Use high for LCP image */
  fetchPriority?: "high" | "low" | "auto";
  /** Object-fit */
  fit?: FitOptions;
}

const IMAGE_OPTIMIZATION_ENDPOINT = "https://webdraw.com/image-optimize";

export const getOptimizedImageUrl = ({
  src,
  width,
  height,
  fit = "cover",
}: {
  src: string;
  width: number;
  height?: number;
  fit?: FitOptions;
}) => {
  // Don't optimize data URLs or relative URLs
  if (src.startsWith("data:") || src.startsWith("/")) {
    return src;
  }

  const url = new URL(IMAGE_OPTIMIZATION_ENDPOINT);

  url.searchParams.set("src", src);
  url.searchParams.set("width", width.toString());
  if (height) url.searchParams.set("height", height.toString());
  url.searchParams.set("fit", fit);

  return url.href;
};

export const Image = forwardRef<HTMLImageElement, ImageProps>(({
  src,
  width,
  height,
  fit = "cover",
  loading = "lazy",
  sizes,
  className,
  alt = "",
  ...props
}, ref) => {
  const optimizedSrc = getOptimizedImageUrl({
    src,
    width,
    height,
    fit,
  });

  return (
    <img
      ref={ref}
      src={optimizedSrc}
      srcSet={optimizedSrc}
      width={width}
      height={height}
      loading={loading}
      sizes={sizes}
      className={className}
      style={{ objectFit: fit }}
      alt={alt}
      {...props}
    />
  );
});

Image.displayName = "Image";

export default Image;
