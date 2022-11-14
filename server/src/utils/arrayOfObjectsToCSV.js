export default function arrayOfObjectsToCSV(arr) {
  const csvString = [
    [
      "Name",
      "Email",
      "Username",
      "Company",
      "Location",
      "New York?",
      "Bio",
      "Github URL",
      "User Bio Match",
      "Num. Contributed Repos w/ >100 stars",
      "Num. Contributed Repos w/ README Match",
      "Contributions",
      "Ten Star Repos",
      "User README Match",
      "Company is also Org.",
      "Github Followers",
      "Num. User Orgs w/ Bio Match",
      "Num. User Org Repos w/ >100 stars",
    ],
    ...arr.map((e) => [
      e.name.replaceAll(",", ""),
      e.email,
      e.username,
      e.company.replaceAll(",", ";"),
      e.location.replaceAll(",", ""),
      e.isInNewYork,
      e.bio.replaceAll("\n", "").replaceAll(",", ";"),
      e.url,
      e.bioMatchesKeywords,
      e.numContributedReposWithHundredStars,
      e.numContributedReposWithReadmeKeywordMatch,
      e.contributionCount,
      e.tenStarRepoCount,
      e.isUserReadmeKeywordMatch,
      e.userCompanyIsOrg,
      e.githubFollowers,
      e.numOrgBioKeywordMatch,
      e.numOrgReposWithHundredStars,
    ]),
  ]
    .map((item) => item.join(","))
    .join("\n");
  return csvString;
}
