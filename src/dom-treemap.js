function constructData(elem) {
  function getDomPath(elem, depth) {
    var stack = [];

    if (elem === document.documentElement) {
      return[':root'];
    }

    while (elem.parentNode != null) {
      var sibCount = 0;
      var sibIndex = 0;
      for (var i = 0; i < elem.parentNode.childNodes.length; i++) {
        var sib = elem.parentNode.childNodes[i];
        if (sib.nodeName === elem.nodeName) {
          if (sib === elem) {
            sibIndex = sibCount;
          }
          sibCount++;
        }
      }
      if (elem.id) {
        stack.unshift('#' + elem.id);
      } else if (elem.className && elem.className.split) {
        stack.unshift('.' + elem.className.split(' ').filter(c => !!c).join('.'));
      } else if (sibCount > 1) {
        stack.unshift(elem.nodeName.toLowerCase() + ':eq(' + sibIndex + ')');
      } else {
        stack.unshift(elem.nodeName.toLowerCase());
      }
      elem = elem.parentNode;
    }

    stack = stack.slice(1); // removes the html element

    if (depth) {
      return stack.slice(-1 * Math.abs(depth));
    }

    return stack;
  }

  function getDescendantNodeCount(elem) {
    return Array.from(elem.children).reduce((accumulator, child) => {
      return accumulator + getDescendantNodeCount(child);
    }, elem.childNodes.length);
  }

  return {
    selector: getDomPath(elem).join(' > '),
    name: getDomPath(elem, 1).join(' > '),
    children: Array.from(elem.children).map((elem, index) => ({
      index,
      selector: getDomPath(elem).join(' > '),
      name: getDomPath(elem, 1).join(' > '),
      value: getDescendantNodeCount(elem),
    })),
  }
}

function updateTreeMap() {
  const treemap = (data) => {
    const DOM = {
      uid: (name) => {
        let count = 0;

        function Id(id) {
          this.id = id;
          this.href = new URL(`#${id}`, location) + '';
        }

        Id.prototype.toString = function () {
          return 'url(' + this.href + ')';
        };

        return new Id('O-' + (name == null ? '' : name + '-') + ++count);
      }
    }
    const format = d3.format(',d');
    const color = d3.scaleOrdinal(d3.schemeCategory10);
    let width = window.innerWidth;
    let height = Math.min(window.innerWidth, window.innerHeight);

    const tile = (node, x0, y0, x1, y1) => {
      d3.treemapBinary(node, 0, 0, width, height);
      for (const child of node.children) {
        child.x0 = x0 + child.x0 / width * (x1 - x0);
        child.x1 = x0 + child.x1 / width * (x1 - x0);
        child.y0 = y0 + child.y0 / height * (y1 - y0);
        child.y1 = y0 + child.y1 / height * (y1 - y0);
      }
    }

    const treemap = data => d3.treemap()
      .tile(tile)
      .size([width, height])
      .padding(1)
      .round(true)
      (d3.hierarchy(data)
        .sum(d => d.value)
        .sort((a, b) => b.value - a.value))

    const root = treemap(data);

    const svg = d3.create('svg')
      .attr('viewBox', [0, 0, width, height])
      .style('font', '10px sans-serif');

    const leaf = svg.selectAll('g')
      .data(root.leaves())
      .join('g')
      .attr('transform', d => `translate(${d.x0},${d.y0})`)
      .attr('cursor', 'pointer')
      .on('click', (event, d) => {
        const evalExpression = `inspect($0.querySelector(':scope > :nth-child(${d.data.index + 1})'))`;

        chrome.devtools.inspectedWindow.eval(evalExpression);
      });

    leaf.append('title')
      .text(d => `${d.data.name}: ${format(d.value)} descendants`);

    leaf.append('rect')
      .attr('id', d => (d.leafUid = DOM.uid('leaf')).id)
      .attr('fill', d => { while (d.depth > 1) d = d.parent; return color(d.data.name); })
      .attr('fill-opacity', 0.6)
      .attr('width', d => d.x1 - d.x0)
      .attr('height', d => d.y1 - d.y0);

    leaf.append('clipPath')
      .attr('id', d => (d.clipUid = DOM.uid('clip')).id)
      .append('use')
      .attr('xlink:href', d => d.leafUid.href);

    leaf.append('foreignObject')
      .attr('clip-path', d => d.clipUid)
      .attr('width', d => d.x1 - d.x0)
      .attr('height', d => d.y1 - d.y0)
      .attr('fill-opacity', (d, i, nodes) => i === nodes.length - 1 ? 0.7 : null)
      .append('xhtml:p')
      .attr('style', d => `width: 100%; overflow: hidden; margin: 0; padding: min(1em, ${(d.y1 - d.y0) / 4}px); font-size: min(0.75rem, ${(d.y1 - d.y0) / 2}px); white-space: nowrap; text-overflow: ellipsis;`)
      .html(d => `<strong style="font-family: monospace">${d.data.name}</strong>${(d.y1 - d.y0) > 20 ? '<br>' : ''}${(d.x1 - d.x0) > 60 ? `${format(d.value)} descendants` : ''}`);

    return svg.node();
  };
  const evalExpression = `(() => { ${constructData.toString()}; return constructData($0) })()`;

  if (typeof chrome !== 'undefined' && chrome.devtools) {
    chrome.devtools.inspectedWindow.eval(
      evalExpression,
      function (data, isException) {
        if (isException) {
          console.error(isException);
          return;
        }

        const svg = treemap(data);
        const oldSvg = document.getElementById('treemap').querySelector('svg');

        document.getElementById('selected-element').textContent = data.name;
        document.getElementById('treemap')[oldSvg ? 'replaceChild' : 'appendChild'](svg, oldSvg);
      }
    );
  } else {
    const data = constructData(document.body);
    const svg = treemap(data);
    const oldSvg = document.getElementById('treemap').querySelector('svg');

    document.getElementById('selected-element').textContent = data.name;
    document.getElementById('treemap')[oldSvg ? 'replaceChild' : 'appendChild'](svg, oldSvg);
  }
}

updateTreeMap();

window.addEventListener('resize', () => {
  updateTreeMap();
});

document.addEventListener('click', (e) => {
  if (!e.target.closest('button')) {
    return;
  }

  const evalExpression = `if ($0 !== document.documentElement) inspect($0.parentElement)`;

  chrome.devtools.inspectedWindow.eval(evalExpression);
});

if (typeof chrome !== 'undefined' && chrome.devtools) {
  chrome.devtools.panels.elements.onSelectionChanged.addListener(() => {
    updateTreeMap();
  });

  document.documentElement.classList.add(`-theme-with-${chrome.devtools.panels.themeName}-background`);
}
