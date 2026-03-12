const { Low } = require('lowdb');
const { JSONFile } = require('lowdb/node');
const path = require('path');
const file = path.join(__dirname, 'db.json');
const adapter = new JSONFile(file);
const db = new Low(adapter, {});
const { nanoid } = require('nanoid');

async function initDB(){
  await db.read();
  db.data = db.data || {};
  await db.write();
}
module.exports = { db, initDB, nanoid };
