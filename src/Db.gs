var Db = {
  cache: {},
  dirty: {},
  
  _getSpreadsheet: function() {
    return SpreadsheetApp.getActiveSpreadsheet();
  },
  
  _getSheet: function(tableName) {
    var ss = this._getSpreadsheet();
    var sheet = ss.getSheetByName(tableName);
    if (!sheet) {
      sheet = ss.insertSheet(tableName);
      // Initialize headers based on SCHEMA
      if (SCHEMA.Tables[tableName]) {
        var headers = Object.keys(SCHEMA.Tables[tableName]);
        sheet.appendRow(headers);
        sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
        sheet.setFrozenRows(1);
      }
    }
    return sheet;
  },
  
  _loadTable: function(tableName) {
    if (this.cache[tableName]) return this.cache[tableName];
    
    var sheet = this._getSheet(tableName);
    var data = sheet.getDataRange().getValues();
    var headers = data[0];
    var records = [];
    
    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      var record = {};
      for (var j = 0; j < headers.length; j++) {
        var val = row[j];
        if (typeof val === 'string' && (val.startsWith('{') || val.startsWith('['))) {
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
  
  update: function(tableName, record) {
    var records = this._loadTable(tableName);
    var index = records.findIndex(function(r) { return r.id === record.id; });
    if (index > -1) {
      records[index] = record;
      this.dirty[tableName] = true;
    }
  },
  
  flush: function() {
    var self = this;
    Object.keys(this.dirty).forEach(function(tableName) {
      if (self.dirty[tableName]) {
        var sheet = self._getSheet(tableName);
        var records = self.cache[tableName];
        if (records.length === 0) return;
        
        var headers = Object.keys(SCHEMA.Tables[tableName]);
        var rows = [headers];
        
        records.forEach(function(record) {
          var row = [];
          headers.forEach(function(header) {
            var val = record[header];
            if (typeof val === 'object' && val !== null) {
              row.push(Util.stringifySafe(val));
            } else {
              row.push(val !== undefined ? val : '');
            }
          });
          rows.push(row);
        });
        
        sheet.clearContents();
        sheet.getRange(1, 1, rows.length, headers.length).setValues(rows);
        self.dirty[tableName] = false;
      }
    });
  }
};
