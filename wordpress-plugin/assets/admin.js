(function ($) {
  $(function () {
    $("#ch-connector-test").on("click", function () {
      const $btn = $(this);
      const $result = $("#ch-connector-test-result");
      $btn.prop("disabled", true);
      $result.text("Testing…");

      $.post(chConnector.ajaxUrl, {
        action: "ch_connector_test_connection",
        nonce: chConnector.nonce,
      })
        .done((res) => $result.text(res.data.message).css("color", res.success ? "green" : "red"))
        .fail(() => $result.text("Request failed.").css("color", "red"))
        .always(() => $btn.prop("disabled", false));
    });

    $("#ch-connector-resync").on("click", function () {
      const $btn = $(this);
      const $result = $("#ch-connector-resync-result");
      const count = $("#ch-connector-resync-count").val();
      $btn.prop("disabled", true);
      $result.text("Re-syncing…");

      $.post(chConnector.ajaxUrl, {
        action: "ch_connector_resync",
        nonce: chConnector.nonce,
        count,
      })
        .done((res) => $result.text(res.data.message).css("color", res.success ? "green" : "red"))
        .fail(() => $result.text("Request failed.").css("color", "red"))
        .always(() => $btn.prop("disabled", false));
    });
  });
})(jQuery);
