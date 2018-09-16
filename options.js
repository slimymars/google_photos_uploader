function getGooglePhotoAlbums(render) {
  function getAlbumAtom(token, retry, render) {
    $.ajax({
      url: "https://picasaweb.google.com/data/feed/api/user/default",
      type: 'GET',
      dataType: 'xml',
      headers: {
        'GData-Version': '3.0',
        'Authorization': "Bearer " + token
      }
    })
        .done(function (xml) {
          render(xml)
        })
        .fail(function (jqXhr, textStatus) {
          if (jpXhr.status == 401 && retry) {
            // 認証失敗
            chrome.identity.removeCachedAuthToken(
                {"token": token},
                function () {
                  chrome.identity.getAuthToken({'interactive': true}, function (token) {
                    getAlbumAtom(token, false, render);
                  })
                });
          } else {
            alert(textStatus);
          }
        });
  }

  chrome.identity.getAuthToken({'interactive': true}, function (token) {
    getAlbumAtom(token, true, render);
  });
}

function analyzeGooglePhotoXML(append_jq) {
  var html = "";
  return function (xml) {
    $(xml).find("entry").each(function () {
      var h = $(this);
      html += ['<li albumid="', h.find('gphoto\\:id').text(),
        '" class="ui-state-default">', h.find(">title").text(), "</li>\n"].join("");
    });
    append_jq.append(html);
    append_jq.find("li").draggable({
      connectToSortable: "#in_menu",
      helper: "clone",
      revert: "invalid",
      stop: function (event, ui) {
        ui.helper.append("<span class='ui-icon ui-icon-trash trash'></span>");
        ui.helper.off("dragstop");
        ui.helper.find("span.trash").click(function () {
          $(this).parent().remove();
        })
      }
    });
    $("#album_menu").toggle("slide", 1000);
  }
}

function makeLiForJson() {
  chrome.storage.local.get("menuList", function (data) {
    var i;
    var html = "";
    var json = data['menuList'];
    if (json === void 0) {
        html += "<li class='ui-state-default ui-state-disabled'>オプション...</li>\n";
    } else {
        for (i = 0; i < json.length; i++) {
            if (json[i]['id'] === void 0) {
                //idがundefinedのとき == オプション画面
                html += "<li class='ui-state-default ui-state-disabled'>オプション...</li>\n";
            } else {
                html += ['<li class="ui-state-default" albumid="',
                    json[i]["id"], '">', json[i]["name"], "<span class='ui-icon ui-icon-trash trash'></span></li>\n"].join("");
            }
        }
    }
    if (html === "") {
      html = '<li class="ui-state-default ui-state-disabled">オプション...</li>';
    }
    $("#in_menu").append(html);
    $("#in_menu").sortable({
      placeholder: "ui-state-highlight",
      revert: true,
      cancel: ".ui-state-disabled"
    });
    $("ul, li").disableSelection();
    $("span.trash").click(function () {
      $(this).parent().remove();
    });
  });
}

function makeJsonForLi(data) {
  var json = [];
  data.each(function () {
    json.push(
        {
          "id": $(this).attr("albumid"),
          "name": $(this).text()
        }
    );
  });
  chrome.storage.local.set({"menuList": json}, function () {
    alert("保存しました");
  });
}

$(function () {
  makeLiForJson();
  $("#add").click(function () {
    if ($("#album_list li").length === 0) {
      getGooglePhotoAlbums(analyzeGooglePhotoXML($("#album_list")));
    } else {
      $("#album_menu").toggle("slide", 1000);
    }
  });
  $("#save").click(function () {
    makeJsonForLi($("#in_menu li"));
  });

});
