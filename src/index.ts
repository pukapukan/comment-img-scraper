import DCInsideScraper from "./DcinsideScraper";

const scraper = new DCInsideScraper({ board: "hit", targetCount: 100 });

scraper.execute().then(() => console.log("done"));