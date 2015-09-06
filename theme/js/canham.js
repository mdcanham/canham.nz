var Canham = {
  contexts: { }
};

Canham.contexts.common = function common() {

};

Canham.run = function () {
  var main = Canham;
  main.ready = function ready() {
    main.contexts.common();
    var classes = $('body').attr('class').replace(/-([a-z])/g, function (g) { return g[1].toUpperCase(); }).split(/\s+/);
    classes.forEach(function (item) {
      if (main.contexts[item]) {
        main.contexts[item]();
      }
    });
  };

  $(document).ready(main.ready);
};

