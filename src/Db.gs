var Db = {
  cache: {},
  dirty: {},
  _ss: null,

  /**
   * Uses the spreadsheet ID from Script Properties when set (required for a standalone web app,
   * where getActiveSpreadsheet() returns null), otherwise falls back to the bound spreadsheet.
   */
  _getSpreadsheet: function() {
    if (this._ss) return this._ss;
    var id = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
    this._ss = id ? SpreadsheetApp.openById(id) : SpreadsheetApp.getActiveSpreadsheet();
    if (!this._ss) {
      throw new Error('No spreadsheet configured. Set the SPREADSHEET_ID script property.');
    }
    return this._ss;
  },

  _getSheet: function(tableName) {
    var ss = this._getSpreadsheet();
    var sheet = ss.getSheetByName(tableName);
    if (!sheet) sheet = ss.insertSheet(tableName);

    // Write headers whenever the sheet is empty, including sheets created by hand.
    if (sheet.getLastRow() === 0 && SCHEMA.Tables[tableName]) {
      var headers = Object.keys(SCHEMA.Tables[tableName]);
      sheet.appendRow(headers);
      sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
      sheet.setFrozenRows(1);
    }
    return sheet;
  },

  _loadTable: function(tableName) {
    if (this.cache[tableName]) return this.cache[tableName];

    var sheet = this._getSheet(tableName);
    var data = sheet.getDataRange().getValues();
    var headers = data.length ? data[0] : [];
    var records = [];

    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      var record = {};
      for (var j = 0; j < headers.length; j++) {
        var val = row[j];
        if (typeof val === 'string' && (val.charAt(0) === '{' || val.charAt(0) === '[')) {
          var parsed = Util.parseJsonSafe(val);
          record[headers[j]] = parsed !== null ? parsed : val;
        } else {
          record[headers[j]] = val;
        }
      }
      records.push(record);
    }

    this.cache[tableName] = records;
    return records;
  },

  query: function(tableName, predicate) {
    var records = this._loadTable(tableName);
    return predicate ? records.filter(predicate) : records;
  },

  insert: function(tableName, record) {
    var records = this._loadTable(tableName);
    records.push(record);
    this.dirty[tableName] = true;
    return record;
  },

  /** Replaces the cached record with the same id. Returns false if no such record exists. */
  update: function(tableName, record) {
    var records = this._loadTable(tableName);
    var index = records.findIndex(function(r) { return r.id === record.id; });
    if (index === -1) return false;
    records[index] = record;
    this.dirty[tableName] = true;
    return true;
  },

  flush: function() {
    var self = this;
    Object.keys(this.dirty).forEach(function(tableName) {
      if (!self.dirty[tableName]) return;

      var records = self.cache[tableName] || [];
      self.dirty[tableName] = false;
      if (records.length === 0) return;

      var headers = Object.keys(SCHEMA.Tables[tableName]);
      var rows = [headers];

      records.forEach(function(record) {
        rows.push(headers.map(function(header) {
          var val = record[header];
          if (val === undefined || val === null) return '';
          if (typeof val === 'object') return Util.stringifySafe(val) || '';
          return val;
        }));
      });

      var sheet = self._getSheet(tableName);
      var range = sheet.getRange(1, 1, rows.length, headers.length);
      sheet.clearContents();
      // Plain-text format so answers like "+91 98..." or "1-2" are not turned into numbers or dates.
      range.setNumberFormat('@');
      range.setValues(rows);
    });
  }
};
