export const extractionMessageFixtures = [
  {
    name: "clear English order",
    message: "Hi, this is Asha. Please print 200 A4 flyers by 2026-11-02. Deliver to 12 MG Road.",
  },
  {
    name: "Hinglish order",
    message: "Ravi here, 50 vinyl stickers chahiye, size 3 inch, kal tak ready kar dena.",
  },
  {
    name: "missing quantity",
    message: "Meera here, need a flex banner for the shop. Call me to confirm how many.",
  },
  {
    name: "two products",
    message: "Please make 100 business cards and 2 acrylic signboards for Nikhil.",
  },
  {
    name: "not an order",
    message: "Thanks for sharing the shop timings. I will visit next week.",
  },
  {
    name: "relative deadline",
    message: "I'm Kiran. Need 20 posters by Friday, please.",
  },
] as const;
