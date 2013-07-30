var util = require('util');
/**
  @contsructor fs
  @param data js object representing the filesystem
*/
var FS = module.exports = function (data, config) {
  config = config || {};
  this._root = Node.fromJSON('', data);

  this._config = {
    timeout: config.timeout || 200
  };
};

FS.prototype.toString = function () {
  console.log(this._root.toString());
};


/* Nodejs methods */

FS.prototype.readdirSync = function (path) {
  var dir = this._root.browseTo(path);
  if (dir.getType() !== 'dir')
    throw 'Error : this is not a dir';
  return dir.getChildrenNames();
};

FS.prototype.readdir = function (path, cb) {
  setTimeout(function () {
    try {
      var dir = this.readdirSync(path);
      cb(null, dir);
    } catch (e) {
      cb(e);
    }
  }.bind(this), this._config.timeout);
};

FS.prototype.readFileSync = function (path) {
  var f = this._root.browseTo(path);
  if (f.getType() !== 'file')
    throw 'Error : this is not a file';
  return f.getContents();
};

FS.prototype.readFile = function (path, cb) {
  setTimeout(function () {
    try {
      var dir = this.readFileSync(path);
      cb(null, dir);
    } catch (e) {
      cb(e);
    }
  }.bind(this), this._config.timeout);
};

FS.prototype.writeFileSync = function (path, data) {
  var f = this._root.browseTo(path, true);
  if (f.getType() !== 'file')
    throw 'Error : this is not a file';
  f.setContents(data);
};

FS.prototype.writeFile = function (path, data, cb) {
  setTimeout(function () {
    try {
      this.writeFileSync(path, data);
      cb(null);
    } catch (e) {
      cb(e);
    }
  }.bind(this), this._config.timeout);
};

FS.prototype.existsSync = function (path) {
  try {
    return this._root.browseTo(path) != null;
  } catch (e) {
    return false;
  }
};

FS.prototype.exists = function (path, cb) {
  setTimeout(function () {
    var dir = this.existsSync(path);
    cb(dir);
  }.bind(this), this._config.timeout);
};


FS.prototype.rmdirSync = function (path, cb) {
  var dir = this._root.browseTo(path);
  if (dir.getType() !== 'dir')
    throw 'Error : this is not a dir';
  if (dir.parent == null)
    throw 'Error : cannot remove fs root';
  if (!dir.isEmpty())
    throw 'Error : dir is not empty';
  dir.parent.remove(dir);
};

FS.prototype.rmdir = function (path, cb) {
  setTimeout(function () {
    try {
      this.rmdirSync(path);
      cb(null);
    } catch (e) {
      cb(e);
    }
  }.bind(this), this._config.timeout);
};

/* Symbolic stuff */
FS.prototype.createSymbolicFile = function (path, filename, contents) {
  var dir = this._root.browseTo(path);
  if (dir.getType() === 'dir') {
    dir.append(new SymbolicFile(filename, contents));
  }
};


// An Node in the filesystem

function Node(type, name) {
  this._name = name;
  this._type = type;
  this.parent = null;
}

Node.prototype.getName = function () {
  return this._name;
};

Node.fromJSON = function (name, data) {
  var n;
  if (typeof data !== 'string') {
    n = new Dir(name);
    for (var i in data) {
      n.append(Node.fromJSON(i, data[i]));
    }
  } else {
    n = new File(name);
    n.setContents(data);
  }
  return n;
};

Node.prototype.browseTo = function (path) {
  if (path.length === 0)
    return this;
  else
    throw 'ERROR : no such node';
};

Node.prototype.getType = function () {
  return this._type;
};

Node.prototype.getPath = function () {
  if (this.parent != null) {
    return this.parent.getPath() + this.getName();
  }
  return '';
};



function Dir(name) {
  Node.call(this, 'dir', name);
  this._children = {};
}
util.inherits(Dir, Node);

Dir.prototype.append = function (node) {
  if (node.parent)
    node.parent.remove(node);
  node.parent = this;

  var name = node.getName();
  if (name in this._children)
    throw new Error(name + ' : File already exists');
  this._children[name] = node;
};

Dir.prototype.getPath = function () {
  return Node.prototype.getPath.apply(this) + '/';
};

Dir.prototype.remove = function (node) {
  if (node.parent === this) {
    delete this._children[node.getName()];
    node.parent = null;
  }
};

Dir.prototype.isEmpty = function () {
  return Object.keys(this._children).length === 0;
};

Dir.prototype.browseTo = function (path, create) {
  if (path.length === 0 || path === '/') {
    return this;
  } else if (path.charAt(0) === '/') {
    path = path.substr(1);
  }

  var id = path.indexOf('/');
  var name = (id == -1) ? path : path.substr(0, id);
  path = (id == -1) ? '' : path.substr(id);

  if (name in this._children) {
    return this._children[name].browseTo(path, create);
  } else if (name === '.') {
    return this.browseTo(path);
  } else if (name === '..') {
    if (this.parent == null) throw 'trying to get past fs root !';
    return this.parent.browseTo(path);
  } else if (path.length === 0 && create) {
    var node = new File(name);
    this.append(node);
    return node;
  }

  throw 'TODO : error, no such file or directory';
};

Dir.prototype.getChildrenNames = function () {
  // return Object.keys(this._children);
  // The above is nice but doesn't work with symbolic execution
  var k = [];
  for (var i in this._children) {
    k.push(this._children[i].getName());
  }
  return k;
};

Dir.prototype.toString = function (tab) {
  if (!tab) tab = '';
  var str = tab + '"' + this.getName() + '" : {\n';
  for (var i in this._children) {
    str += this._children[i].toString(tab + '  ');
  }
  return str + tab + '}\n';
};



function File(name) {
  Node.call(this, 'file', name);

  this._contents = '';
}
util.inherits(File, Node);

File.prototype.toString = function (tab) {
  return (tab || '') + '"' + this.getName() + '" : ' + JSON.stringify(this._contents) + ' \n';
};

File.prototype.setContents = function (text) {
  this._contents = text;
};

File.prototype.getContents = function () {
  return this._contents;
};

function SymbolicFile(name, contents) {
  File.call(this, name);

  this._defaultContents = contents;
}
util.inherits(SymbolicFile, File);

SymbolicFile.prototype.getName = function () {
  if (!this._hasSymbolicName) {
    this._hasSymbolicName = true;
    this._name = symb('filename:' + this.getPath(), this._name);
  }
  return Node.prototype.getName.apply(this);
};

SymbolicFile.prototype.getContents = function () {
  if (!this._hasSymbolicContent) {
    this._hasSymbolicContent = true;
    this.setContents(symb('filecontents:' + this.getPath(), this._defaultContents || 'default contents'));
  }
  return File.prototype.getContents.apply(this);
};
