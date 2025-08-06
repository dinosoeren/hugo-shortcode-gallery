if (!("HSCGjQuery" in window)) {
  if (!window.jQuery) {
    throw new Error(
      "jQuery is not loaded, hugo-shortcode-gallery wont work without it!"
    );
  }
  window.HSCGjQuery = window.jQuery.noConflict(true);
}

(function ($) {
  window.hugoShortcodeGallery = {
    init: function (options) {
      const wrapper = $("#" + options.galleryWrapperId);
      const gallery = $("#" + options.galleryId);

      // the instance of swipebox, it will be set once justifiedGallery is initialized
      let swipeboxInstance = null;

      // before the gallery initialization the listener has to be added
      // else we can get a race condition and the listener is never called
      gallery.on("jg.complete", () => {
        if (options.previewType === "blur" || options.previewType === "color") {
          $(() => {
            gallery.find(".lazy").Lazy({
              visibleOnly: true,
              afterLoad: (element) => element.removeClass("lazy-blur"),
            });
          });
        }

        swipeboxInstance = gallery
          .find(".galleryImg")
          .swipebox($.extend({}, options.swipeboxParameters));
      });

      // initialize the justified gallery
      gallery.justifiedGallery(
        $.extend(
          {
            rowHeight: options.rowHeight,
            margins: options.margins,
            border: 0,
            randomize: options.randomize,
            waitThumbnailsLoad: false,
            lastRow: options.lastRow,
            captions: false,
            filter:
              options.filterOptions && options.filterOptions.length > 0
                ? () => false
                : (e) => e,
          },
          options.justifiedGalleryParameters
        )
      );

      if (options.filterOptions && options.filterOptions.length > 0) {
        // this function can be used to create a function that can be used by justifiedGallery
        // for filtering images by their metadata
        function createMetadataFilter(filterFunction) {
          return (entry, index, array) => {
            let meta = $(entry).find("a").attr("data-meta");
            meta = meta ? JSON.parse(meta) : {};

            let include = filterFunction(meta);

            // only those images visible in justified gallery should be displayed
            // in swipebox (only <a> with class galleryImg are displayed in swipebox)
            $(entry).find("a").toggleClass("galleryImg", include);

            return include;
          };
        }

        // this function returns a function that can be used by justifiedGallery
        // for filtering images by their tags
        function createTagFilter(tagsRegexString) {
          const tagsRegex = RegExp(tagsRegexString);
          return createMetadataFilter((meta) => {
            let tags = meta.Tags;
            tags = tags ? tags : [];
            return tags.some((tag) => tagsRegex.test(tag));
          });
        }

        // this function returns a function that can be used by justifiedGallery
        // for filtering images by their description
        function createImageDescriptionFilter(descriptionRegexString) {
          const descriptionRegex = RegExp(descriptionRegexString);
          return createMetadataFilter((meta) => {
            let imageDescription = meta.ImageDescription;
            return (
              imageDescription !== null &&
              descriptionRegex.test(imageDescription)
            );
          });
        }

        // this function returns a function that can be used by justifiedGallery
        // for filtering images by their star rating
        function createRatingFilter(min, max) {
          return createMetadataFilter((meta) => {
            let rating = meta.Rating;
            if (rating === null) {
              rating = -1;
            }
            return rating >= min && rating <= max;
          });
        }

        // this function returns a function that can be used by justifiedGallery
        // for filtering images by their color labels
        function createColorLabelFilter(color) {
          color = color.charAt(0).toLowerCase();
          return createMetadataFilter((meta) => {
            let colors = meta.ColorLabels;
            return colors && colors.includes(color);
          });
        }

        // insert a div for inserting filter buttons before the gallery
        const filterBar = $("<div class='justified-gallery-filterbar'/>");
        gallery.before(filterBar);

        function setFulltab(activate) {
          if (activate == wrapper.hasClass("fulltab")) {
            return; // nothing to do, we are already in the right state
          }

          wrapper.toggleClass("fulltab");
          gallery.justifiedGallery({
            rowHeight: options.rowHeight * (activate ? 1.5 : 1.0),
            lastRow: activate ? "nojustify" : options.lastRow,
            // force justifiedGallery to refresh
            refreshTime: 0,
          });
          // force justifiedGallery to refresh
          gallery.data("jg.controller").startImgAnalyzer();
          fullTabButton.html(
            wrapper.hasClass("fulltab")
              ? options.compressIcon
              : options.expandIcon
          );
        }

        const fullTabButton = $("<button/>");
        fullTabButton.html(options.expandIcon);
        fullTabButton.click(() => setFulltab(!wrapper.hasClass("fulltab")));
        filterBar.append(fullTabButton);
        $(document).keyup((e) => {
          // when ESC is pressed
          if (e.keyCode === 27) {
            setFulltab(false);
          }
        });

        function activateFilterButton(filterButton) {
          // activate associated filter
          gallery.justifiedGallery({ filter: filterButton.filter });
          // remove select class from all other selected buttons
          filterBar.find(".selected").removeClass("selected");
          filterButton.addClass("selected");
        }

        // check if the url contains an instruction to apply a specific filter
        // eg. example.com/images/#gallery-filter=Birds
        const params = new URLSearchParams(location.hash.replace(/^\#/, ""));
        let activeFilter = params.get("gallery-filter");
        if (!activeFilter) {
          // default to first filter
          activeFilter = options.filterOptions[0].label;
        }

        // create a button for each filter entry
        options.filterOptions.forEach((filterConfig) => {
          let filter; // create a filter function based on the available attributes of filterConfig
          if (filterConfig.tags) {
            filter = createTagFilter(filterConfig.tags);
          } else if (filterConfig.rating) {
            if (filterConfig.rating.includes("-")) {
              minMax = filterConfig.rating.split("-"); // e.g. "3-5"
            } else {
              minMax = [filterConfig.rating, filterConfig.rating]; // e.g. "4"
            }
            filter = createRatingFilter(
              parseInt(minMax[0]),
              parseInt(minMax[1])
            );
          } else if (filterConfig.color_label) {
            filter = createColorLabelFilter(filterConfig.color_label);
          } else if (filterConfig.description) {
            filter = createImageDescriptionFilter(filterConfig.description);
          } else {
            // default to always true filter
            filter = createMetadataFilter((meta) => true);
          }

          const filterButton = $("<button/>");
          filterButton.text(filterConfig.label);
          filterButton.filter = filter;
          filterButton.click(() => {
            activateFilterButton(filterButton);

            if (options.storeSelectedFilterInUrl) {
              // save applied filter in browser url
              const params = new URLSearchParams(
                location.hash.replace(/^\#/, "")
              );
              params.set("gallery-filter", filterConfig.label);
              window.history.replaceState(
                "",
                "",
                location.pathname + location.search + "#" + params.toString()
              );
            }
          });
          filterBar.append(filterButton);

          if (filterConfig.label.toLowerCase() === activeFilter.toLowerCase()) {
            activateFilterButton(filterButton);
          }
        });
      }
    },
  };
})(window.HSCGjQuery);
