var Util = {
  generateId: function() {
    return Utilities.getUuid();
  },
  
  parseJsonSafe: function(str) {
    try {
      return JSON.parse(str);
    } catch (e) {
      return null;
    }
  },
  
  stringifySafe: function(obj) {
    try {
      return JSON.stringify(obj);
    } catch (e) {
      return null;
    }
  }
};
