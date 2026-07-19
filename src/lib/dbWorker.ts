import initSqlJs, { Database } from "sql.js";
import { DEFAULT_DB_SCHEMA } from "./defaultSchema";

let db: Database | null = null;

self.onmessage = async (e: MessageEvent) => {
  const { id, action, payload } = e.data;

  try {
    switch (action) {
      case "loadIsv": {
        const { files, baseUrl } = payload;
        
        const SQL = await initSqlJs({
          locateFile: (file) => file.endsWith('.wasm') 
            ? `${baseUrl}sql-wasm.wasm` 
            : `${baseUrl}${file}`
        });
        
        db = new SQL.Database();
        let processed = 0;
        
        for (const file of files as File[]) {
          const fileName = file.name;
          const tableName = fileName.replace(/\.isv$/i, '').toLowerCase();
          
          const columns = DEFAULT_DB_SCHEMA[tableName];
          if (!columns) {
            console.warn(`Skipping ${fileName}: no schema found`);
            continue;
          }
          
          self.postMessage({ type: 'progress', table: tableName, current: processed + 1, total: files.length });
          
          db.run(`CREATE TABLE ${tableName} (${columns.map(c => `"${c}" TEXT`).join(", ")});`);
          db.run("BEGIN TRANSACTION;");
          
          const stmt = db.prepare(`INSERT INTO ${tableName} VALUES (${columns.map(() => "?").join(",")});`);
          
          const stream = file.stream().pipeThrough(new TextDecoderStream());
          const reader = stream.getReader();
          let partialLine = "";
          
          while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            
            const lines = (partialLine + value).split('\n');
            partialLine = lines.pop() || "";
            
            for (const line of lines) {
              if (!line.trim()) continue;
              const values = line.split('^').map(v => v.replace(/\r$/, ''));
              stmt.run(columns.map((_, i) => values[i] !== undefined ? values[i] : null));
            }
          }
          
          if (partialLine.trim()) {
            const values = partialLine.split('^').map(v => v.replace(/\r$/, ''));
            stmt.run(columns.map((_, i) => values[i] !== undefined ? values[i] : null));
          }
          
          stmt.free();
          db.run("COMMIT;");
          processed++;
        }
        
        self.postMessage({ type: 'progress', table: "Creating indexes...", current: files.length, total: files.length });
        
        const INDEXES_TO_CREATE: Record<string, string[]> = {
          inducks_story: ["storycode", "storyheadercode", "firstpublicationdate"],
          inducks_storyversion: ["storycode", "storyversioncode", "entirepages"],
          inducks_storyjob: ["storyversioncode", "personcode"],
          inducks_entry: ["storyversioncode", "issuecode"],
          inducks_issue: ["issuecode", "publicationcode"],
          inducks_publication: ["publicationcode", "countrycode", "languagecode"],
          inducks_herocharacter: ["storycode", "charactercode"],
          inducks_character: ["charactercode"],
          inducks_person: ["personcode"],
          inducks_country: ["countrycode"],
          inducks_language: ["languagecode"],
          inducks_storyheader: ["title", "storyheadercode"],
          inducks_appearance: ["storyversioncode", "charactercode"],
          inducks_storysubseries: ["storycode", "subseriescode"],
          inducks_subseriesname: ["subseriescode"],
          inducks_entryurl: ["entrycode"],
          inducks_storydescription: ["storyversioncode"],
          inducks_charactername: ["charactercode"],
          inducks_characterurl: ["charactercode"],
          inducks_publishingjob: ["storyversioncode", "publisherid"],
          inducks_storycodes: ["storycode", "alternativecode"]
        };

        db.run("BEGIN TRANSACTION;");
        for (const [table, columns] of Object.entries(INDEXES_TO_CREATE)) {
          for (const col of columns) {
            try {
              db.run(`CREATE INDEX IF NOT EXISTS idx_${table}_${col} ON ${table}(${col});`);
            } catch (err) {}
          }
        }
        db.run("COMMIT;");
        
        self.postMessage({ id, type: "success" });
        break;
      }
      
      case "execute": {
        if (!db) throw new Error("Database not loaded");
        const { sql, args, stream } = payload;
        
        const stmt = db.prepare(sql);
        stmt.bind(args || []);
        
        const rows = [];
        let count = 0;
        
        while (stmt.step()) {
          const row = stmt.getAsObject();
          if (stream) {
            // Send each row individually for progressive rendering
            self.postMessage({ id, type: "row", row, index: count });
          } else {
            rows.push(row);
          }
          count++;
        }
        
        stmt.free();
        self.postMessage({ id, type: "success", rows: stream ? undefined : rows, count });
        break;
      }
      
      case "unload": {
        if (db) {
          db.close();
          db = null;
        }
        self.postMessage({ id, type: "success" });
        break;
      }
    }
  } catch (error: any) {
    self.postMessage({ id, type: "error", error: error.message || String(error) });
  }
};
