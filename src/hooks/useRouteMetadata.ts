import { useEffect } from "react";
import { executeQuery } from "@/lib/db";

interface RouteMetadataProps {
  activeTab: string;
  selectedStorycode: string | null;
  selectedIssuecode: string | null;
  selectedPersoncode: string | null;
  selectedCharactercode: string | null;
  selectedCountrycode: string | null;
  selectedPublicationcode: string | null;
}

export function useRouteMetadata({
  activeTab,
  selectedStorycode,
  selectedIssuecode,
  selectedPersoncode,
  selectedCharactercode,
  selectedCountrycode,
  selectedPublicationcode
}: RouteMetadataProps) {
  useEffect(() => {
    let isCancelled = false;

    const updateMetadata = async () => {
      let title = "InducksButBetter - Disney Comics Database";
      let description = "Search and explore the massive Disney comics Inducks database with modern design.";

      try {
        if (selectedStorycode) {
          const res = await executeQuery({
            sql: "SELECT title FROM inducks_story WHERE storycode = ?",
            args: [selectedStorycode]
          });
          if (!isCancelled && res.rows.length > 0) {
            const storyTitle = res.rows[0].title || "Untitled";
            title = `Inducks - Story: ${storyTitle} (${selectedStorycode})`;
            description = `Explore details, publications, appearances, and creators of the Disney comic story: ${storyTitle} (${selectedStorycode}).`;
          }
        } else if (selectedIssuecode) {
          const res = await executeQuery({
            sql: `
              SELECT i.title as issue_title, p.title as pub_title, i.issuenumber 
              FROM inducks_issue i 
              JOIN inducks_publication p ON i.publicationcode = p.publicationcode 
              WHERE i.issuecode = ?
            `,
            args: [selectedIssuecode]
          });
          if (!isCancelled && res.rows.length > 0) {
            const row = res.rows[0];
            const issueName = row.pub_title ? `${row.pub_title} #${row.issuenumber}` : `Issue: ${selectedIssuecode}`;
            title = `Inducks - ${issueName}`;
            description = `Explore contents, pages, indexers, and details of the Disney comic issue: ${issueName}.`;
          }
        } else if (selectedPersoncode) {
          const res = await executeQuery({
            sql: "SELECT fullname FROM inducks_person WHERE personcode = ?",
            args: [selectedPersoncode]
          });
          if (!isCancelled && res.rows.length > 0) {
            const name = res.rows[0].fullname || selectedPersoncode;
            title = `Inducks - Creator: ${name}`;
            description = `Explore Disney comics bibliography, co-authors, and characters by: ${name}.`;
          }
        } else if (selectedCharactercode) {
          const res = await executeQuery({
            sql: "SELECT charactername FROM inducks_character WHERE charactercode = ?",
            args: [selectedCharactercode]
          });
          if (!isCancelled && res.rows.length > 0) {
            const name = res.rows[0].charactername || selectedCharactercode;
            title = `Inducks - Character: ${name}`;
            description = `Explore Disney comic stories featuring the character: ${name}.`;
          }
        } else if (selectedCountrycode) {
          const res = await executeQuery({
            sql: "SELECT countryname FROM inducks_country WHERE countrycode = ?",
            args: [selectedCountrycode]
          });
          if (!isCancelled && res.rows.length > 0) {
            const name = res.rows[0].countryname || selectedCountrycode;
            title = `Inducks - Country: ${name}`;
            description = `Browse Disney publications and series published in: ${name}.`;
          }
        } else if (selectedPublicationcode) {
          const res = await executeQuery({
            sql: "SELECT title FROM inducks_publication WHERE publicationcode = ?",
            args: [selectedPublicationcode]
          });
          if (!isCancelled && res.rows.length > 0) {
            const name = res.rows[0].title || selectedPublicationcode;
            title = `Inducks - Magazine: ${name}`;
            description = `Explore issue lists and index details for Disney publication: ${name} (${selectedPublicationcode}).`;
          }
        } else {
          // Tab default titles
          switch (activeTab) {
            case "stories":
              title = "Inducks - Search Stories";
              description = "Search and explore Disney comic stories, writers, artists, and publications.";
              break;
            case "publications":
              title = "Inducks - Search Publications";
              description = "Filter and find Disney comics publications, magazines, and issues from around the world.";
              break;
            case "authors":
              title = "Inducks - Browse Creators";
              description = "Search and browse Disney comics writers, pencillers, inkers, and editors.";
              break;
            case "characters":
              title = "Inducks - Browse Characters";
              description = "Explore Disney characters and find stories they appear in.";
              break;
            case "countries":
              title = "Inducks - Browse Countries";
              description = "Browse all countries publishing Disney comics and magazines.";
              break;
            case "sql":
              title = "Inducks - SQL Editor";
              description = "Run custom SQLite queries directly on the local or remote Inducks database.";
              break;
            case "settings":
              title = "Inducks - Settings";
              description = "Configure search preferences, Inducks cookie session, or upload local database dump.";
              break;
          }
        }
      } catch (err) {
        console.error("Metadata hook error:", err);
      }

      if (!isCancelled) {
        document.title = title;
        const metaDesc = document.querySelector('meta[name="description"]');
        if (metaDesc) {
          metaDesc.setAttribute("content", description);
        }
      }
    };

    updateMetadata();

    return () => {
      isCancelled = true;
    };
  }, [
    activeTab,
    selectedStorycode,
    selectedIssuecode,
    selectedPersoncode,
    selectedCharactercode,
    selectedCountrycode,
    selectedPublicationcode
  ]);
}
