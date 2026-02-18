import { getDb, countWords } from './db.js';
import { words } from '../data/words.js';

export function seedIfEmpty(): void {
  if (countWords() > 0) return;

  const db = getDb();
  const insert = db.prepare(
    `INSERT OR IGNORE INTO words (word, definition, part_of_speech, example, level)
     VALUES (@word, @definition, @part_of_speech, @example, @level)`,
  );

  const insertMany = db.transaction((entries: typeof words) => {
    for (const entry of entries) {
      insert.run(entry);
    }
  });

  insertMany(words);
  console.log(`[seed] Inserted ${words.length} words into the database.`);
}
