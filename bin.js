#!/usr/bin/env node
const GitHub = require('./');
const lunr = require('lunr');

var corpus = null;
var index = {
  commands: null,
  parameters: null
};


function toSpaceCase(x) {
  return x.replace(/\./, ' ').replace(/([A-Z])/g, ' $1');
}

function loadCorpus() {
  corpus = require('./corpus');
}

function setupIndex() {
  var {commands, parameters} = corpus;
  index.commands = lunr(function() {
    this.ref('key');
    this.field('name');
    this.field('desc');
    var {name, desc} = commands;
    for(var i=0, I=name.length; i<I; i++)
      this.add({key: i, name: toSpaceCase(name[i]), desc: desc[i]});
  });
  index.parameters = lunr(func)
}
