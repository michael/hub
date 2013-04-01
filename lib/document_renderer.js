
var _ = require('underscore'),
    hl = require("highlight").Highlight;

module.exports = DocumentRenderer;

function DocumentRenderer (doc) {
  this.doc = doc;
}

DocumentRenderer.render = function (doc) {
  var renderer = new DocumentRenderer(doc);
  return renderer.render();
};

DocumentRenderer.prototype.nodes = function() {
  var result = [];
  var content = this.doc.content;

  function node(id) {
    return content.nodes[id];
  }

  if (!content.head) return;
  var current = node(content.head);
  var index = 0;

  result.push(current);
  while (current = node(current.next)) {
    index += 1;
    result.push(current);
  }
  return result;
};


DocumentRenderer.prototype.render = function() {
  var content = this.doc.content;
  var properties = content.properties;

  function annotationsForNode(node) {
    var annotations = content.annotations;
    var result = [];
    var mappings = {
      "starts": {},
      "ends": {}
    };

    function registerMapping(type, index, annotation) {
      if (!mappings[type][index]) mappings[type][index] = [];
      mappings[type][index].push(annotation);
    }

    _.each(annotations, function(a) {
      if (a.node === node.id && a.pos) {
        result.push(a);
        registerMapping('starts', a.pos[0], a);
        registerMapping('ends', a.pos[0] + a.pos[1], a);
      }
    });

    return mappings;
  }

  function renderAnnotatedContent(node) {
    var mappings = annotationsForNode(node);

    function tagsFor(type, index) {
      var annotations = mappings[type][index];
      var res = "";

      _.each(annotations, function(a) {
        if (type === "starts") {
          res += '<span class="'+a.type+'">';
        } else {
          res += '</span>';
        }
      });
      return res;
    }

    var output = "";
    _.each(node.content.split(''), function(ch, index) {
      // 1. prepend start tags
      output += tagsFor("starts", index);

      // 2. add character
      output += ch;

      // 3. append end tags
      output += tagsFor("ends", index);
    });
    return output;
  }

  var html = '';
  if (properties.cover) html += '<div class="cover"><img src="'+properties.cover+'"/></div>';
  html += '<div class="meta"><div class="meta-inner">';
  html += '<div class="date">'+this.doc.created_at.toDateString()+'</div>';
  html += '<div class="title">'+properties.title+'</div>';
  html += '<div class="author">by <a href="/'+this.doc.creator.username+'">'+this.doc.creator.name+'</a></div>';

  if (properties.abstract && properties.abstract !== "Enter abstract") {
    html += '<div class="abstract">'+properties.abstract+'</div>';
  }

  html += '</div></div>'; // .meta
  html += '<div class="nodes">';

  _.each(this.nodes(), function(node) {
    if (node.type === "heading") {
      html += '<h2>'+renderAnnotatedContent(node)+'</h2>';
    } else if (node.type === "text") {
      html += '<p>'+renderAnnotatedContent(node)+'</p>';
    } else if (node.type === "image") {
      html += '<img src="'+node.content+'"/>';
    } else if (node.type === "code") {
      html += '<pre>'+hl(node.content)+'</pre>';
    }
  });

  html += '</div';
  return html;
};
