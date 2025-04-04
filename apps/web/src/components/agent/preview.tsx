import { DetailedHTMLProps, IframeHTMLAttributes } from "react";

type Props = DetailedHTMLProps<
  IframeHTMLAttributes<HTMLIFrameElement>,
  HTMLIFrameElement
>;

const allowances = [
  "camera",
  "microphone",
  "display-capture",
  "autoplay",
  "accelerometer",
  "clipboard-write",
  "encrypted-media",
  "gyroscope",
  "picture-in-picture",
  "web-share",
  "fullscreen",
  "geolocation",
  "payment",
].join("; ");

function Preview(props: Props) {
  return (
    <iframe
      allow={allowances}
      allowFullScreen
      sandbox="allow-scripts"
      className="w-full h-full"
      {...props}
    />
  );
}

export default Preview;
