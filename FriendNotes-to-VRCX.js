const sqlite3 = require("sqlite3");
const fs = require('fs');
const date = require('date-and-time')

var settings = {}
var db;

async function loadSettings() {
    return new Promise(resolve => {

        fs.readFile('settings.json', 'utf8', function (err, data) {
            try {
                settings = JSON.parse(data);
                settings.VRCX_path = settings.VRCX_path.replaceAll('%appdata%', process.env.APPDATA)
            } catch (e) {
                resolve('error')
            }

            resolve()
            
        });

    });
}

function setupDatabase() {
    return new Promise(resolve => {
      
        db = new sqlite3.Database(settings.VRCX_path, (err) => {
            if (err) {
                resolve('error')
            } else {
                console.log("DataBase Connected");
            }
            resolve()
        });

    });
}

function setVRCXNote(user_id, note) {
    note = note.replaceAll(`'`, `''`)
    return new Promise(resolve => {
      
        var edited_at = new Date().toISOString()
        db.all(`INSERT OR REPLACE INTO memos(user_id, edited_at, memo) VALUES ('${user_id}', '${edited_at}', '${note}')`, function(err) {
            if(err != null) console.log(err);
            console.log(`Set VRCX note ${user_id}: ${note}`)
            resolve()
        });

    });
}

function getVRCXNote(user_id) {
    return new Promise(resolve => {
      
        db.all(`SELECT * FROM memos WHERE user_id = '${user_id}'`, function(err, allRows) {
            if(err != null) {
                console.log(err);
            } else {
                if (allRows.length > 0) {
                    var note = allRows[0].memo
                    resolve(note)
                }

            }
            resolve(null)
        });

    });
}

function getFriendNotes() {
    return new Promise(resolve => {
        var notes = {}
      
        fs.readFile(settings.FriendNotes_path, 'utf8', function (err, data) {
            if (err) {
                resolve('error')
                return
            }
        
            var json = JSON.parse(data);
        
            for (const [key, value] of Object.entries(json)) {
                var userID = key;
                var note = value.Note;
                var DateAdded = value.DateAdded;
                if (DateAdded != undefined) {
                    DateAdded = date.format(new Date(DateAdded), settings.dateFormat)
                }

                var pastNames = '';
                if (value.DisplayNames != undefined) {
                    value.DisplayNames.forEach(function (item, index) {
                        var dateSeen = item.Date
                        if (dateSeen == undefined) dateSeen = item.DateFirstSeen
                        if (dateSeen == undefined) return
        
                        var d = date.format(new Date(dateSeen), settings.dateFormat)
                        var name = item.Name
                        pastNames += name + ": " + d + '\n'
                    });
                    pastNames = pastNames.trim()
                }
        
                var stuff = '';
        
                if (note != undefined && settings.include_Notes) stuff += note.trim() + '\n'
                if (DateAdded != undefined && settings.include_DateAdded) stuff += 'Added: ' + DateAdded + '\n'
                if (pastNames.length > 0 && settings.include_PastNames) stuff += 'Past Names: ' + pastNames
                stuff = stuff.trim()

                if (stuff.length > 0)
                    notes[userID] = stuff
            }
            resolve(notes)
            
        });

    });
}

async function doThings() {
    if (await loadSettings() == 'error') {
        console.log(temp)
        console.error("Failed to read settings.json. Try re-downloading it")
        return
    }

    if (await setupDatabase() == 'error') {
        console.error("Couldn't find VRCX.sqlite3. Make sure VRCX_path is set correctly in settings.json")
        return
    }

    var notes = await getFriendNotes()
    if (notes == 'error') {
        console.error("Couldn't find FriendNotes.json. Make sure FriendNotes_path is set correctly in settings.json")
        return
    }

    for (const [user_id, friendNotesnote] of Object.entries(notes)) {
        var vrcxNote = await getVRCXNote(user_id)
        if (vrcxNote == null) vrcxNote = '';

        if (vrcxNote.includes(friendNotesnote)) {
            console.log(`skipping ${user_id}, same note in both databases`)
            continue
        }

        var newNote = (vrcxNote + '\n' + friendNotesnote).trim()
        await setVRCXNote(user_id, newNote)
    }
}

doThings();