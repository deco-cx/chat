export const WELL_KNOWN_CAPYBARA_AVATARS = [
  "https://assets.webdraw.app/uploads/capy.png",
  "https://assets.webdraw.app/uploads/capy-1.png",
  "https://assets.webdraw.app/uploads/capy-2.png",
  "https://assets.webdraw.app/uploads/capy-3.png",
  "https://assets.webdraw.app/uploads/capy-4.png",
  "https://assets.webdraw.app/uploads/capy-5.png",
  "https://assets.webdraw.app/uploads/capy-6.png",
  "https://assets.webdraw.app/uploads/capy-7.png",
  "https://assets.webdraw.app/uploads/capy-8.png",
  "https://assets.webdraw.app/uploads/capy-9.png",
  "https://assets.webdraw.app/uploads/capy-10.png",
  "https://assets.webdraw.app/uploads/capy-11.png",
  "https://assets.webdraw.app/uploads/capy-12.png",
  "https://assets.webdraw.app/uploads/capy-13.png",
  "https://assets.webdraw.app/uploads/capy-14.png",
  "https://assets.webdraw.app/uploads/capy-15.png",
  "https://assets.webdraw.app/uploads/capy-16.png",
  "https://assets.webdraw.app/uploads/capy-17.png",
  "https://assets.webdraw.app/uploads/capy-18.png",
  "https://assets.webdraw.app/uploads/capy-19.png",
  "https://assets.webdraw.app/uploads/capy-20.png",
  "https://assets.webdraw.app/uploads/capy-21.png",
  "https://assets.webdraw.app/uploads/capy-22.png",
  "https://assets.webdraw.app/uploads/capy-23.png",
  "https://assets.webdraw.app/uploads/capy-24.png",
  "https://assets.webdraw.app/uploads/capy-25.png",
  "https://assets.webdraw.app/uploads/capy-26.png",
  "https://assets.webdraw.app/uploads/capy-27.png",
  "https://assets.webdraw.app/uploads/capy-28.png",
  "https://assets.webdraw.app/uploads/capy-29.png",
  "https://assets.webdraw.app/uploads/capy-30.png",
  "https://assets.webdraw.app/uploads/capy-31.png",
  "https://assets.webdraw.app/uploads/capy-32.png",
  "https://assets.webdraw.app/uploads/capy-33.png",
  "https://assets.webdraw.app/uploads/capy-34.png",
  "https://assets.webdraw.app/uploads/capy-35.png",
  "https://assets.webdraw.app/uploads/capy-36.png",
  "https://assets.webdraw.app/uploads/capy-37.png",
  "https://assets.webdraw.app/uploads/capy-38.png",
];

export const pickCapybaraAvatar = () => {
  const index = Math.floor(WELL_KNOWN_CAPYBARA_AVATARS.length * Math.random());
  const url = WELL_KNOWN_CAPYBARA_AVATARS[index];

  const avatar = new URL("/image-optimize", "https://deco.chat");
  avatar.searchParams.set("src", url);
  avatar.searchParams.set("width", "128");
  avatar.searchParams.set("height", "128");
  avatar.searchParams.set("fit", "cover");

  return avatar.href;
};
