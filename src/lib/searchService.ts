export interface SearchFilters {
  title?: string;
  description?: string;
  includeComments?: boolean | string;
  storycode?: string;
  charactercode?: string[] | string;
  excludeCharactercode?: string[] | string;
  personRoles?: { id: string; code: string; role: string }[];
  excludePersoncode?: string[] | string;
  publisherid?: string;
  kind?: string[] | string;
  pagesMin?: number;
  pagesMax?: number;
  pagesExact?: string | number;
  rowsperpage?: string;
  panelsperstrip?: string;
  stripsperpage?: string;
  language?: string[] | string;
  country?: string[] | string;
  herocode?: string[] | string;
  onlyCollection?: boolean;
  dateAfter?: string;
  dateBefore?: string;
  nationality?: string[] | string;
  universes?: string[] | string;
  subseriescode?: string[] | string;
  noOtherCharacters?: boolean | string;
  sort?: string;
  page?: number | string;
  indexingIncomplete?: boolean | string;
  multipleParts?: boolean | string;
  hasImage?: 'all' | 'yes' | 'no';
  lang?: string;
}

export interface SearchQueryResponse {
  query: string;
  countQuery: string;
  params: any[];
  countParams: any[];
  pageSize: number;
  page: number;
}

export function buildAdvancedSearchQuery(filters: SearchFilters): SearchQueryResponse {
  const pageSize = Math.max(1, parseInt(String(filters.rowsperpage || "24"), 10) || 24);
  const page = Math.max(1, parseInt(String(filters.page || "1"), 10) || 1);
  const offset = (page - 1) * pageSize;

  const where: string[] = [];
  const p: any[] = [];
  const cteJoins = new Set<string>();
  const lang = filters.lang || "fr";

  if (filters.storycode) {
    let code = filters.storycode.trim();
    
    const lowerCode = code.toLowerCase();
    if (/^(wdc|os|us|fc|dda|ym|yd)\d*/.test(lowerCode)) {
      if (lowerCode.startsWith("wdc")) code = "W WDC " + code.substring(3).trim();
      else if (lowerCode.startsWith("os")) code = "W OS " + code.substring(2).trim();
      else if (lowerCode.startsWith("us")) code = "W US " + code.substring(2).trim();
      else if (lowerCode.startsWith("fc")) code = "W OS " + code.substring(2).trim();
      else if (lowerCode.startsWith("dda")) code = "W OS " + code.substring(3).trim();
      else if (lowerCode.startsWith("ym")) code = "YM " + code.substring(2).trim();
      else if (lowerCode.startsWith("yd")) code = "YD " + code.substring(2).trim();
    } else if (lowerCode.startsWith("i") && lowerCode.length > 1 && /^\d/.test(lowerCode.substring(1).trim())) {
      code = "I TL " + code.substring(1).trim();
    }

    const parts = code.split(/\s+/).filter(Boolean);
    
    if (parts.length > 0) {
      const indexPattern = parts.map((part, i) => {
        const cleaned = part.replace(/[^a-zA-Z0-9]/g, '%');
        return i === 0 ? cleaned : ' %' + cleaned;
      }).join('') + '%';
      
      where.push("s.storycode LIKE ?");
      p.push(indexPattern);
    }
  }

  if (filters.title) {
    cteJoins.add("sh");
    where.push("(sh.title LIKE ? OR EXISTS (SELECT 1 FROM inducks_entry e_t JOIN inducks_storyversion sv_t ON e_t.storyversioncode = sv_t.storyversioncode WHERE sv_t.storycode = s.storycode AND e_t.title LIKE ?))");
    p.push(`%${filters.title}%`, `%${filters.title}%`);
  }

  if (filters.description) {
    cteJoins.add("sv");
    let descClause = "(sv.plotsummary LIKE ? OR EXISTS (SELECT 1 FROM inducks_storydescription sd WHERE sd.storyversioncode = sv.storyversioncode AND sd.desctext LIKE ?))";
    p.push(`%${filters.description}%`, `%${filters.description}%`);
    if (filters.includeComments === "true" || filters.includeComments === true) {
      descClause = "(sv.plotsummary LIKE ? OR s.storycomment LIKE ? OR EXISTS (SELECT 1 FROM inducks_storydescription sd WHERE sd.storyversioncode = sv.storyversioncode AND sd.desctext LIKE ?))";
      p.push(`%${filters.description}%`);
    }
    where.push(descClause);
  }

  if (filters.kind) {
    const kinds = (Array.isArray(filters.kind) ? filters.kind : String(filters.kind).split(",")).map(k => k.trim()).filter(Boolean);
    if (kinds.length > 0) {
      cteJoins.add("sv");
      where.push(`sv.kind IN (${kinds.map(() => "?").join(",")})`);
      p.push(...kinds);
    }
  }

  if (filters.charactercode) {
    const codes = (Array.isArray(filters.charactercode) ? filters.charactercode : String(filters.charactercode).split(",")).map(c => c.trim()).filter(Boolean);
    if (codes.length > 0) {
      codes.forEach(code => {
        where.push(`EXISTS (SELECT 1 FROM inducks_storyversion sv_c JOIN inducks_appearance app_c ON sv_c.storyversioncode = app_c.storyversioncode WHERE sv_c.storycode = s.storycode AND app_c.charactercode = ?)`);
        p.push(code);
      });
    }
  }

  if (filters.herocode) {
    const codes = (Array.isArray(filters.herocode) ? filters.herocode : String(filters.herocode).split(",")).map(c => c.trim()).filter(Boolean);
    if (codes.length > 0) {
      codes.forEach(code => {
        where.push(`EXISTS (SELECT 1 FROM inducks_storyversion sv_h JOIN inducks_appearance app_h ON sv_h.storyversioncode = app_h.storyversioncode WHERE sv_h.storycode = s.storycode AND app_h.charactercode = ? AND app_h.number = 0)`);
        p.push(code);
      });
    }
  }

  if (filters.excludeCharactercode) {
    const codes = (Array.isArray(filters.excludeCharactercode) ? filters.excludeCharactercode : String(filters.excludeCharactercode).split(",")).map(c => c.trim()).filter(Boolean);
    if (codes.length > 0) {
      cteJoins.add("sv");
      where.push(`NOT EXISTS (SELECT 1 FROM inducks_appearance app_ex WHERE app_ex.storyversioncode = sv.storyversioncode AND app_ex.charactercode IN (${codes.map(() => "?").join(",")}))`);
      p.push(...codes);
    }
  }

  if (filters.universes && Array.isArray(filters.universes)) {
    const universes = filters.universes.filter(u => u && String(u).trim());
    if (universes.length > 0) {
      where.push(`EXISTS (SELECT 1 FROM inducks_storyversion sv_u JOIN inducks_appearance app_u ON sv_u.storyversioncode = app_u.storyversioncode JOIN inducks_ucrelation ucr ON app_u.charactercode = ucr.charactercode WHERE sv_u.storycode = s.storycode AND app_u.number = 0 AND ucr.universecode IN (${universes.map(() => "?").join(",")}))`);
      p.push(...universes);
    }
  }

  if (filters.noOtherCharacters === true || String(filters.noOtherCharacters) === "true") {
    const selectedCharCodes = [
      ...(Array.isArray(filters.charactercode || []) ? (filters.charactercode || []) : String(filters.charactercode || "").split(",")),
      ...(Array.isArray(filters.herocode || []) ? (filters.herocode || []) : String(filters.herocode || "").split(","))
    ].map(c => c.trim()).filter(Boolean);
    const distinctSelectedCount = new Set(selectedCharCodes).size;
    if (distinctSelectedCount > 0) {
      where.push(`EXISTS (SELECT 1 FROM inducks_storyversion sv_no WHERE sv_no.storycode = s.storycode AND (SELECT COUNT(DISTINCT charactercode) FROM inducks_appearance app_count WHERE app_count.storyversioncode = sv_no.storyversioncode) = ?)`);
      p.push(distinctSelectedCount);
    }
  }

  if (filters.personRoles && Array.isArray(filters.personRoles)) {
    const roles = filters.personRoles.filter(pr => pr.code && String(pr.code).trim());
    if (roles.length > 0) {
      cteJoins.add("sv");
      roles.forEach(pr => {
        let roleCondition = "";
        if (pr.role && pr.role !== 'any') {
          roleCondition = `AND sj.plotwritartink LIKE '%${pr.role}%'`;
        }
        where.push(`EXISTS (SELECT 1 FROM inducks_storyjob sj WHERE sj.storyversioncode = sv.storyversioncode AND sj.personcode = ? ${roleCondition})`);
        p.push(pr.code.trim());
      });
    }
  }

  if (filters.excludePersoncode) {
    const codes = (Array.isArray(filters.excludePersoncode) ? filters.excludePersoncode : String(filters.excludePersoncode).split(",")).map(c => c.trim()).filter(Boolean);
    if (codes.length > 0) {
      cteJoins.add("sv");
      where.push(`NOT EXISTS (SELECT 1 FROM inducks_storyjob sj_ex WHERE sj_ex.storyversioncode = sv.storyversioncode AND sj_ex.personcode IN (${codes.map(() => "?").join(",")}))`);
      p.push(...codes);
    }
  }

  if (filters.nationality) {
    const nationalities = (Array.isArray(filters.nationality) ? filters.nationality : String(filters.nationality).split(",")).map(n => n.trim()).filter(Boolean);
    if (nationalities.length > 0) {
      cteJoins.add("sv");
      where.push(`EXISTS (SELECT 1 FROM inducks_storyjob sj_n JOIN inducks_person p_n ON sj_n.personcode = p_n.personcode WHERE sj_n.storyversioncode = sv.storyversioncode AND p_n.nationalitycountrycode IN (${nationalities.map(() => "?").join(",")}))`);
      p.push(...nationalities);
    }
  }

  if (filters.publisherid) {
    cteJoins.add("sv");
    where.push(`EXISTS (SELECT 1 FROM inducks_publishingjob pjob WHERE pjob.storyversioncode = sv.storyversioncode AND pjob.publisherid = ?)`);
    p.push(filters.publisherid);
  }

  if (filters.country || filters.language) {
    const countries = (Array.isArray(filters.country) ? filters.country : [filters.country || ""]).filter(Boolean);
    const languages = (Array.isArray(filters.language) ? filters.language : [filters.language || ""]).filter(Boolean);

    if (countries.length > 0 || languages.length > 0) {
      cteJoins.add("sv");
      if (countries.length > 0) {
        const actualCountries = countries.filter(c => c !== 'UNPUBLISHED');
        const hasUnpublished = countries.includes('UNPUBLISHED');

        const parts = [];
        if (actualCountries.length > 0) {
          parts.push(`EXISTS (SELECT 1 FROM inducks_entry e_c JOIN inducks_issue i_c ON e_c.issuecode = i_c.issuecode JOIN inducks_publication p_c ON i_c.publicationcode = p_c.publicationcode WHERE e_c.storyversioncode = sv.storyversioncode AND p_c.countrycode IN (${actualCountries.map(() => "?").join(",")}))`);
          p.push(...actualCountries);
        }
        if (hasUnpublished) {
          parts.push(`NOT EXISTS (SELECT 1 FROM inducks_entry e_unpub WHERE e_unpub.storyversioncode = sv.storyversioncode)`);
        }

        if (parts.length > 0) {
          where.push(`(${parts.join(" OR ")})`);
        }
      }
      if (languages.length > 0) {
        where.push(`EXISTS (SELECT 1 FROM inducks_entry e_l JOIN inducks_issue i_l ON e_l.issuecode = i_l.issuecode JOIN inducks_publication p_l ON i_l.publicationcode = p_l.publicationcode WHERE e_l.storyversioncode = sv.storyversioncode AND p_l.languagecode IN (${languages.map(() => "?").join(",")}))`);
        p.push(...languages);
      }
    }
  }

  if (filters.hasImage && filters.hasImage !== 'all') {
    cteJoins.add("sv");
    const existsClause = `EXISTS (SELECT 1 FROM inducks_entry e_img JOIN inducks_entryurl eu ON e_img.entrycode = eu.entrycode WHERE e_img.storyversioncode = sv.storyversioncode AND eu.url IS NOT NULL AND eu.url != '' AND eu.sitecode IN ('webusers', 'thumbnails'))`;
    if (filters.hasImage === 'yes') {
      where.push(existsClause);
    } else if (filters.hasImage === 'no') {
      where.push(`NOT ${existsClause}`);
    }
  }

  if (filters.pagesExact) {
    cteJoins.add("sv");
    where.push("sv.entirepages = ?");
    p.push(parseInt(String(filters.pagesExact), 10));
  } else {
    if (filters.pagesMin) { cteJoins.add("sv"); where.push("sv.entirepages >= ?"); p.push(parseInt(String(filters.pagesMin), 10)); }
    if (filters.pagesMax) { cteJoins.add("sv"); where.push("sv.entirepages <= ?"); p.push(parseInt(String(filters.pagesMax), 10)); }
  }

  if (filters.dateAfter) { where.push("s.firstpublicationdate >= ?"); p.push(filters.dateAfter); }
  if (filters.dateBefore) { where.push("s.firstpublicationdate <= ?"); p.push(filters.dateBefore); }

  if (filters.stripsperpage && filters.stripsperpage !== 'all') {
    cteJoins.add("sv");
    where.push("sv.rowsperpage = ?");
    p.push(parseInt(String(filters.stripsperpage), 10));
  }
  if (filters.panelsperstrip && filters.panelsperstrip !== 'all') {
    cteJoins.add("sv");
    where.push("sv.columnsperpage = ?");
    p.push(parseInt(String(filters.panelsperstrip), 10));
  }

  if (filters.indexingIncomplete === "true" || filters.indexingIncomplete === true) {
    where.push(`(NOT EXISTS (SELECT 1 FROM inducks_storyversion sv_i JOIN inducks_appearance app_i ON sv_i.storyversioncode = app_i.storyversioncode WHERE sv_i.storycode = s.storycode) OR EXISTS (SELECT 1 FROM inducks_storyversion sv_i JOIN inducks_appearance app_i ON sv_i.storyversioncode = app_i.storyversioncode WHERE sv_i.storycode = s.storycode AND app_i.charactercode = '?'))`);
  }

  if (filters.multipleParts === "true" || filters.multipleParts === true) {
    cteJoins.add("sv");
    where.push(`EXISTS (SELECT 1 FROM inducks_entry e_p WHERE e_p.storyversioncode = sv.storyversioncode AND e_p.part IS NOT NULL AND e_p.part != '')`);
  }

  if (filters.subseriescode) {
    const codes = (Array.isArray(filters.subseriescode) ? filters.subseriescode : String(filters.subseriescode).split(",")).map(c => c.trim()).filter(Boolean);
    if (codes.length > 0) {
      where.push(`EXISTS (SELECT 1 FROM inducks_storysubseries ss WHERE ss.storycode = s.storycode AND ss.subseriescode IN (${codes.map(() => "?").join(",")}))`);
      p.push(...codes);
    }
  }

  const sort = String(filters.sort || "pubdate_desc");
  if (sort.includes("title")) cteJoins.add("sh");
  if (sort.includes("pages")) cteJoins.add("sv");

  let searchJoinSql = "";
  if (cteJoins.has("sh")) searchJoinSql += " JOIN inducks_storyheader sh ON s.storyheadercode = sh.storyheadercode";
  if (cteJoins.has("sv")) searchJoinSql += " JOIN inducks_storyversion sv ON s.storycode = sv.storycode";

  if (filters.onlyCollection) {
    try {
      const saved = localStorage.getItem("inducks_collection_issues");
      const parsed = saved ? JSON.parse(saved) : [];
      if (Array.isArray(parsed) && parsed.length > 0) {
        searchJoinSql += " JOIN inducks_entry c_entry ON s.storycode = c_entry.storycode";
        where.push(`c_entry.issuecode IN (SELECT value FROM json_each(?))`);
        p.push(JSON.stringify(parsed));
      } else {
        where.push("1 = 0");
      }
    } catch (e) {
      where.push("1 = 0");
    }
  }

  const whereSql = where.length > 0 ? "WHERE " + where.join(" AND ") : "";
  const countQuery = `SELECT COUNT(DISTINCT s.storycode) as total FROM inducks_story s ${searchJoinSql} ${whereSql}`;

  let orderBy = "s.firstpublicationdate DESC, s.storycode ASC";
  if (sort === "pubdate_asc") orderBy = "s.firstpublicationdate ASC, s.storycode ASC";
  else if (sort === "title_az") orderBy = "sh.title ASC";
  else if (sort === "title_za") orderBy = "sh.title DESC";
  else if (sort === "pages_desc") orderBy = "sv.entirepages DESC";
  else if (sort === "pages_asc") orderBy = "sv.entirepages ASC";

  const isDistinctNeeded = cteJoins.size > 0 || filters.subseriescode || filters.herocode || filters.charactercode || filters.excludeCharactercode || filters.universes || filters.noOtherCharacters || filters.personRoles || filters.excludePersoncode || filters.nationality || filters.publisherid || filters.country || filters.language || filters.hasImage || filters.stripsperpage || filters.panelsperstrip || filters.multipleParts;
  const distinctStr = isDistinctNeeded ? "DISTINCT" : "";

  const mainQuery = `
    WITH StoryIds AS (
      SELECT ${distinctStr} s.storycode, s.firstpublicationdate
      FROM inducks_story s
      ${searchJoinSql}
      ${whereSql}
      ORDER BY ${orderBy}
      LIMIT ? OFFSET ?
    ),
    BestVersions AS (
      SELECT sv.*
      FROM inducks_storyversion sv
      JOIN StoryIds ids ON sv.storycode = ids.storycode
      GROUP BY sv.storycode
    )
    SELECT s.storycode,
      COALESCE(
        (SELECT sn.subseriesname FROM inducks_storysubseries ss JOIN inducks_subseriesname sn ON ss.subseriescode = sn.subseriescode WHERE ss.storycode = s.storycode ORDER BY CASE WHEN sn.languagecode = ? THEN 0 ELSE 1 END, sn.preferred DESC LIMIT 1),
        sh.title
      ) as series_title,
      s.firstpublicationdate, sv.kind, sv.entirepages, sv.brokenpagenumerator, sv.brokenpagedenominator, sv.plotsummary, s.storycomment,
      COALESCE(
        (SELECT e.title FROM inducks_entry e JOIN inducks_issue i ON e.issuecode = i.issuecode JOIN inducks_publication pub ON i.publicationcode = pub.publicationcode JOIN inducks_storyversion sv_t ON e.storyversioncode = sv_t.storyversioncode WHERE sv_t.storycode = s.storycode AND e.title IS NOT NULL AND e.title != '' ORDER BY CASE WHEN pub.languagecode = ? THEN 0 ELSE 1 END, e.entrycode ASC LIMIT 1),
        s.title,
        'Sans titre'
      ) as story_title,
      COALESCE(
        (SELECT eu.sitecode || '|' || eu.url
         FROM inducks_entry e_img
         JOIN inducks_entryurl eu ON e_img.entrycode = eu.entrycode
         JOIN inducks_issue i_img ON e_img.issuecode = i_img.issuecode
         JOIN inducks_publication p_img ON i_img.publicationcode = p_img.publicationcode
         WHERE e_img.storyversioncode = sv.storyversioncode
           AND eu.sitecode IN ('webusers', 'thumbnails', 'thumbnails2', 'thumbnails3')
         ORDER BY
           CASE WHEN eu.sitecode = 'webusers' THEN 0 ELSE 1 END,
           COALESCE(i_img.oldestdate, '9999-99-99') ASC,
           CASE WHEN p_img.languagecode = ? THEN 0 ELSE 1 END,
           e_img.entrycode ASC
         LIMIT 1),
        (SELECT eu.sitecode || '|' || eu.url
         FROM inducks_entry e_img
         JOIN inducks_storyversion sv_img ON e_img.storyversioncode = sv_img.storyversioncode
         JOIN inducks_entryurl eu ON e_img.entrycode = eu.entrycode
         JOIN inducks_issue i_img ON e_img.issuecode = i_img.issuecode
         JOIN inducks_entry e_lookup ON e_img.issuecode = e_lookup.issuecode
         WHERE e_lookup.storyversioncode = sv.storyversioncode
           AND sv_img.kind = 'c'
           AND eu.sitecode IN ('webusers', 'thumbnails', 'thumbnails2', 'thumbnails3')
         ORDER BY
           CASE WHEN eu.sitecode = 'webusers' THEN 0 ELSE 1 END,
           COALESCE(i_img.oldestdate, '9999-99-99') ASC
         LIMIT 1)
      ) as story_thumb,
      COALESCE(
        (SELECT CASE
           WHEN TRIM(sd.desctext) LIKE 'Art:%' OR TRIM(sd.desctext) LIKE 'Script:%' OR TRIM(sd.desctext) LIKE 'Plot:%' OR TRIM(sd.desctext) LIKE 'Des:%' OR TRIM(sd.desctext) LIKE 'Desenhos:%' OR TRIM(sd.desctext) LIKE 'Roteiro:%'
                OR TRIM(sd.desctext) LIKE 'Ink:%' OR TRIM(sd.desctext) LIKE 'Pencils:%' OR TRIM(sd.desctext) LIKE 'Pencil:%' OR TRIM(sd.desctext) LIKE 'Inks:%' OR TRIM(sd.desctext) LIKE 'Colors:%'
                OR TRIM(sd.desctext) LIKE 'Letters:%' OR TRIM(sd.desctext) LIKE 'Texte:%' OR TRIM(sd.desctext) LIKE 'Dessin:%' OR TRIM(sd.desctext) LIKE 'Scénario:%'
                OR TRIM(sd.desctext) LIKE 'Scenario:%' OR TRIM(sd.desctext) LIKE 'Translation:%' OR TRIM(sd.desctext) LIKE 'Aut:%' OR TRIM(sd.desctext) LIKE 'Dis:%'
                OR TRIM(sd.desctext) LIKE ',%' OR TRIM(sd.desctext) LIKE '%.%'
           THEN NULL
           ELSE sd.desctext
         END FROM inducks_storydescription sd WHERE sd.storyversioncode = sv.storyversioncode ORDER BY CASE WHEN sd.languagecode = ? THEN 0 ELSE 1 END LIMIT 1),
        (SELECT CASE
           WHEN TRIM(sv.plotsummary) LIKE 'Art:%' OR TRIM(sv.plotsummary) LIKE 'Script:%' OR TRIM(sv.plotsummary) LIKE 'Plot:%' OR TRIM(sv.plotsummary) LIKE 'Des:%' OR TRIM(sv.plotsummary) LIKE 'Desenhos:%' OR TRIM(sv.plotsummary) LIKE 'Roteiro:%'
                OR TRIM(sv.plotsummary) LIKE 'Ink:%' OR TRIM(sv.plotsummary) LIKE 'Pencils:%' OR TRIM(sv.plotsummary) LIKE 'Pencil:%' OR TRIM(sv.plotsummary) LIKE 'Inks:%' OR TRIM(sv.plotsummary) LIKE 'Colors:%'
                OR TRIM(sv.plotsummary) LIKE 'Letters:%' OR TRIM(sv.plotsummary) LIKE 'Texte:%' OR TRIM(sv.plotsummary) LIKE 'Dessin:%' OR TRIM(sv.plotsummary) LIKE 'Scénario:%'
                OR TRIM(sv.plotsummary) LIKE 'Scenario:%' OR TRIM(sv.plotsummary) LIKE 'Translation:%' OR TRIM(sv.plotsummary) LIKE 'Aut:%' OR TRIM(sv.plotsummary) LIKE 'Dis:%'
                OR TRIM(sv.plotsummary) LIKE ',%'
           THEN NULL
           ELSE sv.plotsummary
         END)
      ) as full_description,
      (SELECT GROUP_CONCAT(val, ';') FROM (SELECT DISTINCT sj.plotwritartink || ':' || p.personcode || '|' || p.fullname as val FROM inducks_storyjob sj JOIN inducks_person p ON sj.personcode = p.personcode WHERE sj.storyversioncode = sv.storyversioncode)) as creators,
      (SELECT GROUP_CONCAT(val, ';') FROM (SELECT app_c.charactercode || '|' || COALESCE((SELECT cn.charactername FROM inducks_charactername cn WHERE cn.charactercode = app_c.charactercode AND cn.languagecode = ? ORDER BY cn.preferred DESC LIMIT 1), c.charactername) || '|' || COALESCE(app_c.appearancecomment, '') || '|' || COALESCE(c.charactercomment, '') || '|' || COALESCE((SELECT cu.url FROM inducks_characterurl cu WHERE cu.charactercode = app_c.charactercode LIMIT 1), '') as val FROM inducks_appearance app_c JOIN inducks_character c ON app_c.charactercode = c.charactercode WHERE app_c.storyversioncode = sv.storyversioncode ORDER BY app_c.number ASC)) as character_list,
      (SELECT GROUP_CONCAT(val, ';') FROM (SELECT DISTINCT p_c.countrycode || '|' || p_c.title as val FROM inducks_entry e_c JOIN inducks_issue i_c ON e_c.issuecode = i_c.issuecode JOIN inducks_publication p_c ON i_c.publicationcode = p_c.publicationcode WHERE e_c.storyversioncode = sv.storyversioncode)) as publication_list,
      (SELECT app_h.charactercode 
       FROM inducks_appearance app_h 
       WHERE app_h.storyversioncode = sv.storyversioncode 
         AND app_h.number = 0 
       GROUP BY app_h.storyversioncode
       HAVING COUNT(*) <= 4
       ORDER BY app_h.charactercode ASC LIMIT 1) as hero_code,
      (SELECT COALESCE((SELECT cn.charactername FROM inducks_charactername cn WHERE cn.charactercode = app_h.charactercode AND cn.languagecode = ? ORDER BY cn.preferred DESC LIMIT 1), c_h.charactername) 
       FROM inducks_appearance app_h 
       JOIN inducks_character c_h ON app_h.charactercode = c_h.charactercode 
       WHERE app_h.storyversioncode = sv.storyversioncode 
         AND app_h.number = 0 
       GROUP BY app_h.storyversioncode
       HAVING COUNT(*) <= 4
       ORDER BY app_h.charactercode ASC LIMIT 1) as hero_name,
      sv.rowsperpage, sv.columnsperpage
    FROM StoryIds ids
    JOIN inducks_story s ON ids.storycode = s.storycode
    JOIN inducks_storyheader sh ON s.storyheadercode = sh.storyheadercode
    JOIN BestVersions sv ON s.storycode = sv.storycode
    GROUP BY s.storycode
    ORDER BY ${orderBy}
  `;

  return { query: mainQuery, countQuery, params: [...p, pageSize, offset, lang, lang, lang, lang, lang, lang], countParams: p, pageSize, page };
}
