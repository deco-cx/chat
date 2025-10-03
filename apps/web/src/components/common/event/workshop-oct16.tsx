import { EventBanner } from "../event-banner";

// Workshop URLs
const WORKSHOP_URL = "https://luma.com/ko4zncke"; // Workshop link for all states

// Banner decoration images
const LEFT_BACKGROUND_IMAGE = "/img/workshop-banner-decoration-2.svg";
const RIGHT_BACKGROUND_IMAGE = "/img/workshop-banner-decoration-1.svg";

function getWorkshopOct16Dates(): {
  startDate: Date;
  endDate: Date;
} {
  // Oct 16, 2025 at 5PM
  const startDate = new Date(2025, 9, 16, 17, 0, 0, 0); // October is month 9 (0-indexed), 17 = 5PM
  const endDate = new Date(2025, 9, 16, 19, 0, 0, 0); // Assuming 1 hour duration

  return { startDate, endDate };
}

const { startDate: WORKSHOP_START_DATE, endDate: WORKSHOP_END_DATE } =
  getWorkshopOct16Dates();

export function WorkshopOct16Banner() {
  return (
    <EventBanner
      startDate={WORKSHOP_START_DATE}
      endDate={WORKSHOP_END_DATE}
      upcoming={{
        subtitle: "WORKSHOP",
        title: "Join us as we build an AI Agent for e-commerce promotions live",
        buttonText: "Register Now",
        buttonAction: WORKSHOP_URL,
      }}
      active={{
        subtitle: "WORKSHOP | WE'RE LIVE",
        title: "Build an AI Agent for e-commerce promotions with us",
        buttonText: "Join Live",
        buttonAction: WORKSHOP_URL,
      }}
      past={{
        subtitle: "WORKSHOP | OCT. 16",
        title:
          "Come join us as we build an AI Agent for e-commerce promotions live",
        buttonText: "View Details",
        buttonAction: WORKSHOP_URL,
      }}
      leftBackgroundImage={LEFT_BACKGROUND_IMAGE}
      rightBackgroundImage={RIGHT_BACKGROUND_IMAGE}
      backgroundColor="bg-[#d0ec1a]"
      textColor="text-[#07401A]"
      secondaryTextColor="text-[#07401A]"
      titleColor="text-[#07401A]"
      buttonBackgroundColor="bg-[#07401A]"
      buttonTextColor="text-[#d0ec1a]"
    />
  );
}
