import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { trackEvent } from "../../hooks/analytics.ts";

interface HeroProps {
  logo?: string;
  subtitle?: string;
  heroImage?: string;
  heroImageMobile?: string;
  backgroundImage?: string;
  primaryButtonText?: string;
  primaryButtonLink?: string;
  secondaryButtonText?: string;
  secondaryButtonLink?: string;
}

export function Hero({
  logo = "https://placehold.co/200x80",
  subtitle = "",
  heroImage = "https://placehold.co/1363x497",
  heroImageMobile = heroImage,
  backgroundImage = "",
  primaryButtonText = "Try now",
  primaryButtonLink = "#",
  secondaryButtonText = "Learn more",
  secondaryButtonLink = "#",
}: HeroProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  useGSAP(() => {
    const tl = gsap.timeline({ defaults: { ease: "power3.out" } });

    tl.from(contentRef.current, {
      y: 50,
      opacity: 0,
      duration: 1,
    })
      .from(imageRef.current, {
        y: 100,
        opacity: 0,
        duration: 1,
      }, "-=0.5");
  }, []);

  const handlePrimaryButtonClick = () => {
    trackEvent("deco_chat_landing_try_now_click", {
      buttonText: primaryButtonText,
      buttonLink: primaryButtonLink,
    });
  };

  const handleSecondaryButtonClick = () => {
    trackEvent("deco_chat_landing_learn_more_click", {
      buttonText: secondaryButtonText,
      buttonLink: secondaryButtonLink,
    });
  };

  return (
    <div className="w-full bg-dc-50 px-4 sm:px-6 md:px-8 pt-4 pb-16 md:pb-32">
      <div className="mx-auto max-w-7xl">
        <div className="relative min-h-[500px] sm:min-h-[600px] md:min-h-[700px] lg:min-h-[800px] bg-primary-light rounded-2xl sm:rounded-3xl flex flex-col gap-8 sm:gap-12 md:gap-16 lg:gap-24 items-center overflow-hidden">
          {/* Background pattern */}
          {backgroundImage && (
            <div
              className="absolute inset-0 z-0 opacity-50"
              style={{
                backgroundImage: `url(${backgroundImage})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
                backgroundRepeat: "no-repeat",
                mixBlendMode: "multiply",
              }}
            />
          )}
          <div
            ref={contentRef}
            className="flex flex-col items-center z-10 pt-8 sm:pt-12 md:pt-16 lg:pt-24"
          >
            <img
              src={logo}
              alt="Logo"
              className="h-10 sm:h-12 md:h-16 lg:h-24 w-auto object-contain mb-3 sm:mb-4 md:mb-6"
            />

            {subtitle && (
              <p className="text-center text-xl sm:text-2xl md:text-3xl text-primary-dark font-medium max-w-xl px-4 sm:px-6 mt-6 md:mt-0">
                {subtitle}
              </p>
            )}
          </div>

          <div className="relative w-full flex-1 h-[300px] sm:h-[400px] md:h-[500px] lg:h-[600px] flex items-start justify-center mt-6 md:mt-0">
            <div className="absolute -top-4 sm:-top-6 left-1/2 transform -translate-x-1/2 z-20 whitespace-nowrap">
              <div className="flex gap-2 bg-white px-3 sm:px-4 py-2 sm:py-3 rounded-full w-fit [box-shadow:0px_71px_20px_0px_rgba(1,19,7,0.00),0px_45px_18px_0px_rgba(1,19,7,0.02),0px_26px_15px_0px_rgba(1,19,7,0.07),0px_11px_11px_0px_rgba(1,19,7,0.11),0px_3px_6px_0px_rgba(1,19,7,0.13)]">
                <a
                  href={primaryButtonLink}
                  onClick={handlePrimaryButtonClick}
                  className="px-4 sm:px-5 md:px-6 py-2 bg-primary-dark text-primary-light rounded-full hover:bg-opacity-90 transition-colors text-sm sm:text-base text-center"
                >
                  {primaryButtonText}
                </a>
                <a
                  href={secondaryButtonLink}
                  onClick={handleSecondaryButtonClick}
                  className="px-4 sm:px-5 md:px-6 py-2 bg-dc-200 text-dc-700 rounded-full hover:bg-opacity-90 transition-colors text-sm sm:text-base text-center"
                >
                  {secondaryButtonText}
                </a>
              </div>
            </div>

            <picture className="w-full h-full flex items-start justify-center">
              <source media="(min-width: 768px)" srcSet={heroImage} />
              <img
                ref={imageRef}
                className="w-full h-full object-cover opacity-90 max-w-[1400px]"
                src={heroImageMobile}
                alt="Hero illustration"
                style={{
                  objectPosition: "center top",
                }}
              />
            </picture>
          </div>
        </div>
      </div>
    </div>
  );
}
