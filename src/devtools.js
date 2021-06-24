chrome.devtools.panels.elements.createSidebarPane('DOM Treemap', function(sidebar) {
	sidebar.setPage('dom-treemap.html');
});

chrome.devtools.panels.elements.createSidebarPane('BEM Component Stats', function(sidebar) {
	sidebar.setPage('component-stats.html');
});
