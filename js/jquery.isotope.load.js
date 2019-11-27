var eosPriceUsd;
var ramPriceEos;
var ramPriceUsd;
var netPriceEos;
var netPriceUsd;
var cpuPriceEos;
var cpuPriceUsd;
var maxRam;
var usedRam;
var tlosPriceUsd;
let tlosEosScalar;

var chainEndpoint = "https://telos.eos.barcelona";

$(window).load(function($loadEvent) {
  "use strict";

  /* --- Begin EOS data update routines --- */
  function getXmlHttpRequestObject() {
    if (window.XMLHttpRequest) {
      return new XMLHttpRequest();
    } else if (window.ActiveXObject) {
      return new ActiveXObject("Microsoft.XMLHTTP");
    } else {
      alert(
        "Your Browser does not support AJAX!\nIt's about time to upgrade don't you think?"
      );
    }
    
    if (!Modernizr.promises) {
        alert(
            "Your Browser does not support modern versions of JavaScript!\nIt's about time to upgrade don't you think?"
        );
    }
  }

  function updateEosData() {
      // Global
      let globalPromise = new Promise((resolve, reject) => {
          let reqGlobal = getXmlHttpRequestObject();

          reqGlobal.open("POST", chainEndpoint + "/v1/chain/get_table_rows");
          reqGlobal.onload = () => {
              resolve(reqGlobal);
          };
          reqGlobal.onerror = () => {
              reject(reqGlobal);
          };

          reqGlobal.send(
              JSON.stringify({
                  json: "true",
                  code: "eosio",
                  scope: "eosio",
                  table: "global"
              })
          );
      })
          .then(xhr => {
              let responseJson = JSON.parse(xhr.responseText);

              maxRam = responseJson.rows[0].max_ram_size;
              usedRam = responseJson.rows[0].total_ram_bytes_reserved;
          })
          .catch(xhr => {
              showRequestError(`Failed to get data from (${chainEndpoint}). Please refresh the page and try again. Check console for details. `);
              console.error(xhr);
          });

      // EOS
      let eosPromise = new Promise((resolve, reject) => {
          let reqEos = getXmlHttpRequestObject();
          reqEos.open("GET", "https://api.newdex.io/v1/ticker?symbol=eosio.token-eos-eusd");
          reqEos.onload = () => {
              resolve(reqEos);
          };
          reqEos.onerror = () => {
              reject(reqEos);
          };

          reqEos.send();
      })
          .then(xhr => {
              let responseJson = JSON.parse(xhr.responseText);

              eosPriceUsd = responseJson.data.last;
          })
          .catch(xhr => {
              showRequestError(`Failed to contact data source server (newdex).  Check your browser console for details.`);
              console.error(xhr);
          });

      // TLOS
      let tlosPromise = new Promise((resolve, reject) => {
          let reqTlos = getXmlHttpRequestObject();
          reqTlos.open("GET", "https://api.newdex.io/v1/ticker?symbol=eosio.token-tlos-eos");
          reqTlos.onload = () => {
              resolve(reqTlos);
          };
          reqTlos.onerror = () => {
              reject(reqTlos);
          };

          reqTlos.send();
      })
          .then(xhr => {
              let responseJson = JSON.parse(xhr.responseText);

              tlosEosScalar = responseJson.data.last;
          })
          .catch(xhr => {
              showRequestError(`Failed to contact data source server (newdex).  Check your browser console for details.`);
              console.error(xhr);
          });

      // Ram
      let ramPromise = new Promise((resolve, reject) => {
          let reqRam = getXmlHttpRequestObject();

          reqRam.open("POST", chainEndpoint + "/v1/chain/get_table_rows");
          reqRam.onload = () => {
              resolve(reqRam);
          };
          reqRam.onerror = () => {
              reject(reqRam);
          };

          reqRam.send(
              JSON.stringify({
                  json: "true",
                  code: "eosio",
                  scope: "eosio",
                  table: "rammarket",
                  limit: "10"
              })
          );
      })
          .then(xhr => {
              let responseJson = JSON.parse(xhr.responseText);
              let ramBaseBalance = responseJson.rows[0].base.balance; // Amount of RAM bytes in use
              let ramQuoteBalance = responseJson.rows[0].quote.balance; // Amount of EOS in the RAM collector

              ramBaseBalance = ramBaseBalance.substr(0, ramBaseBalance.indexOf(" "));
              ramQuoteBalance = ramQuoteBalance.substr(0, ramQuoteBalance.indexOf(" "));

              ramPriceEos = ((ramQuoteBalance / ramBaseBalance) * 1024).toFixed(8); // Price in KiB
          })
          .catch(xhr => {
              showRequestError(`Failed to contact data source server (${chainEndpoint}).  Check your browser console for details.`);
              console.error(xhr);
          });

      // Ban
      let banPromise = new Promise((resolve, reject) => {
          let reqBan = getXmlHttpRequestObject();

          reqBan.open("POST", chainEndpoint + "/v1/chain/get_account");
          reqBan.onload = () => {
              resolve(reqBan);
          };
          reqBan.onerror = () => {
              reject(reqBan);
          };

          reqBan.send(JSON.stringify({ account_name: "eosbarcelona" }));
      })
          .then(xhr => {
              let responseJson = JSON.parse(xhr.responseText);
              let netWeight = responseJson.total_resources.net_weight;
              let netStaked = netWeight.substr(0, netWeight.indexOf(" "));
              let netAvailable = responseJson.net_limit.max / 1024; //~ convert bytes to kilobytes
              let cpuWeight = responseJson.total_resources.cpu_weight;
              let cpuStaked = cpuWeight.substr(0, cpuWeight.indexOf(" "));
              let cpuAvailable = responseJson.cpu_limit.max / 1000; // convert microseconds to milliseconds

              netPriceEos = (netStaked / netAvailable / 3).toFixed(8); //~ divide by 3 to get average per day from 3 day avg
              cpuPriceEos = (cpuStaked / cpuAvailable / 3).toFixed(8); //~ divide by 3 to get average per day from 3 day avg
          })
          .catch(xhr => {
              showRequestError(`Failed to contact data source server (${chainEndpoint}).  Check your browser console for details.`);
              console.error(xhr);
          });

      Promise.all([globalPromise, eosPromise, tlosPromise, ramPromise, banPromise])
          .then(() => {
              runCalculations();
              updatePage();
          });
  }

  function runCalculations() {
      tlosPriceUsd = tlosEosScalar * eosPriceUsd;

      ramPriceUsd = ramPriceEos * tlosPriceUsd;
      netPriceUsd = netPriceEos * tlosPriceUsd;
      cpuPriceUsd = cpuPriceEos * tlosPriceUsd;
  }

  function updatePage() {
      let tlosTarget = $("#eos-price-usd");

      tlosTarget.html(`1 TLOS = $${tlosPriceUsd.toFixed(2)} USD`);

      let ramUtilization = (usedRam / maxRam) * 100;
      let maxRamTarget = $("#maxRam");
      maxRamTarget.html(`${(maxRam / 1024 / 1024 / 1024).toFixed(2)} GiB`);

      let allocatedRamElem = $("#allocatedRam");
      allocatedRamElem.html(`${(usedRam / 1024 / 1024 / 1024).toFixed(2)} GiB`);

      let utilizedRamElem = $("#utilizedRam");
      utilizedRamElem.html(`${ramUtilization.toFixed(2)}%`);

      let ramUtilValElem = $("#ramUtilVal");
      ramUtilValElem.html(`${ramUtilization.toFixed(2)}%`);

      let ramUtilBarElem = $("#ramUtilBar");
      ramUtilBarElem.css('width', ramUtilization.toFixed(2) + "%");

      let ramPriceEosElem = $("#ram-price-eos");
      ramPriceEosElem.html(`${ramPriceEos} TLOS per KiB`);

      let ramPriceElem = $("#ram-price-usd");
      ramPriceElem.html(`~ $${(ramPriceEos * tlosPriceUsd).toFixed(3)} USD per KiB`);

      let netPriceEosElem = $("#net-price-eos");
      netPriceEosElem.html(`${netPriceEos} TLOS/KiB/Day`);

      let netPriceUsdElem = $("#net-price-usd");
      netPriceUsdElem.html(`~ $${(netPriceEos * tlosPriceUsd).toFixed(3)} USD/KiB/Day`);

      let cpuPriceEosElem = $("#cpu-price-eos");
      cpuPriceEosElem.html(`${cpuPriceEos} TLOS/ms/Day`);

      let cpuPriceUsdElem = $("#cpu-price-usd");
      cpuPriceUsdElem.html(`~ $${(cpuPriceEos * tlosPriceUsd).toFixed(3)} USD/ms/Day`);
  }
  
  function showRequestError(message) {
      $("#request_error_message").text(message);
      $("#request_error").removeClass("hidden");
  }
  /* --- End of EOS data routines --- */

  function eborLoadIsotope() {
    var $container = $("#container"),
      $optionContainer = $("#options"),
      $options = $optionContainer.find('a[href^="#"]').not('a[href="#"]'),
      isOptionLinkClicked = false;

    $container.isotope({
      itemSelector: ".element",
      resizable: false,
      filter: "*",
      transitionDuration: "0.5s",
      layoutMode: "packery"
    });

    if ($("body").hasClass("video-detail"))
      $container.isotope({
        transformsEnabled: false
      });

    $(window).smartresize(function() {
      $container.isotope("layout");
    });

    $options.on("click", function() {
      var $this = $(this),
        href = $this.attr("href");

      if ($this.hasClass("selected")) {
        return;
      } else {
        $options.removeClass("selected");
        $this.addClass("selected");
      }

      jQuery.bbq.pushState("#" + href);
      isOptionLinkClicked = true;
      updateEosData(); //~ Update all prices
      return false;
    });

    $(window)
      .on("hashchange", function() {
        var theFilter = window.location.hash.replace(/^#/, "");

        if (theFilter == false) theFilter = "home";

        $container.isotope({
          filter: "." + theFilter
        });

        if (isOptionLinkClicked == false) {
          $options.removeClass("selected");
          $optionContainer
            .find('a[href="#' + theFilter + '"]')
            .addClass("selected");
        }

        isOptionLinkClicked = false;
      })
      .trigger("hashchange");
  }
  eborLoadIsotope();
  updateEosData(); //~ Update EOS data on page load
  $(window)
    .trigger("resize")
    .trigger("smartresize");
});

$(".splink").on("click", function() {
  "use strict";
  $("html, body").animate({ scrollTop: 0 }, 1000);
});

$(function() {
  $(".calc-change").on("change keydown paste input", function(e) {
    var elem = $(this);
    var target;
    var unitTarget;
    var unitTargetValue;
    var value;
    var currencyTarget;
    var currencyValue;
    var priceValue;
    var roundingUnits;

    //~ Main switch to handle changes to the forms
    switch (elem.attr("id")) {
      case "eos-afford-ram":
      case "ram-afford-unit":
      case "ram-have-unit":
        unitTarget = document.getElementById("ram-afford-unit");
        unitTargetValue = unitTarget.options[unitTarget.selectedIndex].text;
        currencyTarget = document.getElementById("ram-have-unit");
        currencyValue =
          currencyTarget.options[currencyTarget.selectedIndex].text;

        if (currencyValue == "USD") {
          priceValue = ramPriceUsd;
        }
        if (currencyValue == "TLOS") {
          priceValue = ramPriceEos;
        }
        value = document.getElementById("eos-afford-ram").value;
        switch (unitTargetValue) {
          case "bytes":
            if (currencyValue == "USD") {
              value = (value / ramPriceUsd) * 1024;
              break;
            }
            if (currencyValue == "TLOS") {
              value = (value / ramPriceEos) * 1024;
              break;
            }
          case "KiB":
            if (currencyValue == "USD") {
              value = value / ramPriceUsd;
              break;
            }
            if (currencyValue == "TLOS") {
              value = value / ramPriceEos;
              break;
            }
            break;
          case "MiB":
            if (currencyValue == "USD") {
              value = value / ramPriceUsd / 1024;
              break;
            }
            if (currencyValue == "TLOS") {
              value = value / ramPriceEos / 1024;
              break;
            }
            break;
          case "GiB":
            if (currencyValue == "USD") {
              value = value / ramPriceUsd / 1024 / 1024;
              break;
            }
            if (currencyValue == "TLOS") {
              value = value / ramPriceEos / 1024 / 1024;
              break;
            }
            break;
        }
        target = document.getElementById("result-afford-ram");
        target.innerHTML = value.toFixed(4);
        break;

      case "eos-afford-net":
      case "net-afford-unit":
      case "net-have-unit":
        unitTarget = document.getElementById("net-afford-unit");
        unitTargetValue = unitTarget.options[unitTarget.selectedIndex].text;
        currencyTarget = document.getElementById("net-have-unit");
        currencyValue =
          currencyTarget.options[currencyTarget.selectedIndex].text;

        if (currencyValue == "USD") {
          priceValue = netPriceUsd;
        }
        if (currencyValue == "TLOS") {
          priceValue = netPriceEos;
        }
        value = document.getElementById("eos-afford-net").value;
        switch (unitTargetValue) {
          case "bytes / day":
            if (currencyValue == "USD") {
              value = (value / netPriceUsd) * 1024;
              break;
            }
            if (currencyValue == "TLOS") {
              value = (value / netPriceEos) * 1024;
              break;
            }
          case "KiB / day":
            if (currencyValue == "USD") {
              value = value / netPriceUsd;
              break;
            }
            if (currencyValue == "TLOS") {
              value = value / netPriceEos;
              break;
            }
            break;
          case "MiB / day":
            if (currencyValue == "USD") {
              value = value / netPriceUsd / 1024;
              break;
            }
            if (currencyValue == "TLOS") {
              value = value / netPriceEos / 1024;
              break;
            }
            break;
          case "GiB / day":
            if (currencyValue == "USD") {
              value = value / netPriceUsd / 1024 / 1024;
              break;
            }
            if (currencyValue == "TLOS") {
              value = value / netPriceEos / 1024 / 1024;
              break;
            }
            break;
        }
        target = document.getElementById("result-afford-net");
        target.innerHTML = value.toFixed(4);
        break;

      case "eos-afford-cpu":
      case "cpu-afford-unit":
      case "cpu-have-unit":
        unitTarget = document.getElementById("cpu-afford-unit");
        unitTargetValue = unitTarget.options[unitTarget.selectedIndex].text;
        currencyTarget = document.getElementById("cpu-have-unit");
        currencyValue =
          currencyTarget.options[currencyTarget.selectedIndex].text;

        if (currencyValue == "USD") {
          priceValue = cpuPriceUsd;
        }
        if (currencyValue == "TLOS") {
          priceValue = cpuPriceEos;
        }
        value = document.getElementById("eos-afford-cpu").value;
        switch (unitTargetValue) {
          case "µs / day":
            if (currencyValue == "USD") {
              value = (value / cpuPriceUsd) * 1000;
              break;
            }
            if (currencyValue == "TLOS") {
              value = (value / cpuPriceEos) * 1000;
              break;
            }
          case "ms / day":
            if (currencyValue == "USD") {
              value = value / cpuPriceUsd;
              break;
            }
            if (currencyValue == "TLOS") {
              value = value / cpuPriceEos;
              break;
            }
            break;
          case "s / day":
            if (currencyValue == "USD") {
              value = value / cpuPriceUsd / 1000;
              break;
            }
            if (currencyValue == "TLOS") {
              value = value / cpuPriceEos / 1000;
              break;
            }
            break;
        }
        target = document.getElementById("result-afford-cpu");
        target.innerHTML = value.toFixed(4);
        break;

      case "eos-cost-ram":
      case "ram-need-unit":
      case "ram-cost-unit":
        unitTarget = document.getElementById("ram-need-unit");
        unitTargetValue = unitTarget.options[unitTarget.selectedIndex].text;
        currencyTarget = document.getElementById("ram-cost-unit");
        currencyValue =
          currencyTarget.options[currencyTarget.selectedIndex].text;
        if (currencyValue == "USD") {
          priceValue = ramPriceUsd;
          roundingUnits = 3;
        }
        if (currencyValue == "TLOS") {
          priceValue = ramPriceEos;
          roundingUnits = 8;
        }
        value = document.getElementById("eos-cost-ram").value;
        switch (unitTargetValue) {
          case "bytes":
            if (currencyValue == "USD") {
              value = (value * ramPriceUsd) / 1024;
              break;
            }
            if (currencyValue == "TLOS") {
              value = (value * ramPriceEos) / 1024;
              break;
            }
          case "KiB":
            if (currencyValue == "USD") {
              value = value * ramPriceUsd;
              break;
            }
            if (currencyValue == "TLOS") {
              value = value * ramPriceEos;
              break;
            }
            break;
          case "MiB":
            if (currencyValue == "USD") {
              value = value * ramPriceUsd * 1024;
              break;
            }
            if (currencyValue == "TLOS") {
              value = value * ramPriceEos * 1024;
              break;
            }
            break;
          case "GiB":
            if (currencyValue == "USD") {
              value = value * ramPriceUsd * 1024 * 1024;
              break;
            }
            if (currencyValue == "TLOS") {
              value = value * ramPriceEos * 1024 * 1024;
              break;
            }
            break;
        }

        target = document.getElementById("result-cost-ram");
        target.innerHTML = value.toFixed(roundingUnits);
        break;

      case "eos-cost-net":
      case "net-need-unit":
      case "net-cost-unit":
        unitTarget = document.getElementById("net-need-unit");
        unitTargetValue = unitTarget.options[unitTarget.selectedIndex].text;
        currencyTarget = document.getElementById("net-cost-unit");
        currencyValue =
          currencyTarget.options[currencyTarget.selectedIndex].text;
        if (currencyValue == "USD") {
          priceValue = netPriceUsd;
          roundingUnits = 3;
        }
        if (currencyValue == "TLOS") {
          priceValue = netPriceEos;
          roundingUnits = 8;
        }
        value = document.getElementById("eos-cost-net").value;
        switch (unitTargetValue) {
          case "bytes / day":
            if (currencyValue == "USD") {
              value = (value * netPriceUsd) / 1024;
              break;
            }
            if (currencyValue == "TLOS") {
              value = (value * netPriceEos) / 1024;
              break;
            }
          case "KiB / day":
            if (currencyValue == "USD") {
              value = value * netPriceUsd;
              break;
            }
            if (currencyValue == "TLOS") {
              value = value * netPriceEos;
              break;
            }
            break;
          case "MiB / day":
            if (currencyValue == "USD") {
              value = value * netPriceUsd * 1024;
              break;
            }
            if (currencyValue == "TLOS") {
              value = value * netPriceEos * 1024;
              break;
            }
            break;
          case "GiB / day":
            if (currencyValue == "USD") {
              value = value * netPriceUsd * 1024 * 1024;
              break;
            }
            if (currencyValue == "TLOS") {
              value = value * netPriceEos * 1024 * 1024;
              break;
            }
            break;
        }

        target = document.getElementById("result-cost-net");
        target.innerHTML = value.toFixed(roundingUnits);
        break;

      case "eos-cost-cpu":
      case "cpu-need-unit":
      case "cpu-cost-unit":
        unitTarget = document.getElementById("cpu-need-unit");
        unitTargetValue = unitTarget.options[unitTarget.selectedIndex].text;
        currencyTarget = document.getElementById("cpu-cost-unit");
        currencyValue =
          currencyTarget.options[currencyTarget.selectedIndex].text;
        if (currencyValue == "USD") {
          priceValue = cpuPriceUsd;
          roundingUnits = 3;
        }
        if (currencyValue == "TLOS") {
          priceValue = cpuPriceEos;
          roundingUnits = 8;
        }
        value = document.getElementById("eos-cost-cpu").value;
        switch (unitTargetValue) {
          case "µs / day":
            if (currencyValue == "USD") {
              value = (value * cpuPriceUsd) / 1000;
              break;
            }
            if (currencyValue == "TLOS") {
              value = (value * cpuPriceEos) / 1000;
              break;
            }
          case "ms / day":
            if (currencyValue == "USD") {
              value = value * cpuPriceUsd;
              break;
            }
            if (currencyValue == "TLOS") {
              value = value * cpuPriceEos;
              break;
            }
            break;
          case "s / day":
            if (currencyValue == "USD") {
              value = value * cpuPriceUsd * 1000;
              break;
            }
            if (currencyValue == "TLOS") {
              value = value * cpuPriceEos * 1000;
              break;
            }
            break;
        }

        target = document.getElementById("result-cost-cpu");
        target.innerHTML = value.toFixed(roundingUnits);
        break;
    }
  });
});
