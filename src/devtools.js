chrome.devtools.panels.elements.createSidebarPane('DOM Treemap', function(sidebar) {
	sidebar.setPage('dom-treemap.html');
});

chrome.devtools.panels.create('BEM Component Stats', 'icon128.png', 'component-stats.html');
