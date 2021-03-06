define('payments-manage', ['payments'], function(payments) {
    'use strict';

    function refreshAccountForm(data) {
        var $accountListForm = $('#my-accounts-list');
        var $accountListContainer = $('#bango-account-list');
        $accountListForm.load($accountListContainer.data('url'));
    }

    function newBangoPaymentAccount(e) {
        var $overlay = payments.getOverlay({
            'id': 'add-bango-account',
            'class': 'undismissable'
        });
        payments.setupPaymentAccountOverlay($overlay, showAgreement);
    }

    function confirmPaymentAccountDeletion(data) {
        var spliter = ', ';
        var isPlural = data['app-names'].indexOf(spliter) < 0;
        var $confirm_delete_overlay = payments.getOverlay('payment-account-delete-confirm');
        $confirm_delete_overlay.find('p').text(
            format('Warning: deleting payment account "{0}" ' +
                   'will move {1} associated {2} to an incomplete status ' +
                   'and {3} will no longer be available for sale:',
                   [data['name'],
                    ngettext('that', 'those', isPlural),
                    ngettext('app', 'apps', isPlural),
                    ngettext('it', 'they', isPlural)]));
        $confirm_delete_overlay.find('ul')
                               .html('<li>' + escape_(data['app-names']).split(spliter).join('</li><li>') + '</li>');
        $confirm_delete_overlay.on('click', 'a.payment-account-delete-confirm', _pd(function() {
            $.post(data['delete-url']).then(refreshAccountForm);
            $confirm_delete_overlay.remove();
            $('#paid-island-incomplete').toggleClass('hidden');
        }));
    }

    function setupAgreementOverlay(data, onsubmit) {
        var $waiting_overlay = payments.getOverlay('bango-waiting');

        $.getJSON(data['agreement-url'], function(response) {
            var $overlay = payments.getOverlay('show-agreement');
            $overlay.on('submit', 'form', _pd(function(e) {
                var $form = $(this);

                // Assume the POST below was a success, and close the modal.
                $overlay.trigger('overlay_dismissed').detach();
                onsubmit.apply($form, data);

                // If the POST failed, we show an error message.
                $.post(data['agreement-url'], $form.serialize(), refreshAccountForm).fail(function() {
                    $waiting_overlay.find('h2').text(gettext('Error'));
                    $waiting_overlay.find('p').text(gettext('There was a problem contacting the payment server.'));
                });
            }));

            // Plop in text of agreement.
            $('.agreement-text').text(response.text);
        });
    }

    function showAgreement(data) {
        setupAgreementOverlay(data, function() {
            refreshAccountForm();
            $('#no-payment-providers').addClass('js-hidden');
        });
    }

    function portalRedirect(data) {
        // Redirecting to Bango dev portal if the local redirection is successful.
        $.ajax(data['portal-url'])
            .done(function(data, textStatus, jqXHR) {
                window.location.replace(jqXHR.getResponseHeader("Location"));})
            .fail(function() {
                data.el.closest('td').text(gettext('Authentication error'));});
    }

    function editBangoPaymentAccount(account_url) {
        function paymentAccountSetup() {
            var $overlay = payments.getOverlay('edit-bango-account');
            $overlay.find('form').attr('action', account_url);
            payments.setupPaymentAccountOverlay($overlay, refreshAccountForm);
        }

        // Start the loading screen while we get the account data.
        return function(e) {
            var $waiting_overlay = payments.getOverlay('bango-waiting');
            $.getJSON(account_url, function(data) {
                $waiting_overlay.remove();
                z.body.removeClass('overlayed');
                paymentAccountSetup();
                for (var field in data) {
                    $('#id_' + field).val(data[field]);
                }
            }).fail(function() {
                $waiting_overlay.find('h2').text(gettext('Error'));
                $waiting_overlay.find('p').text(gettext('There was a problem contacting the payment server.'));
            });
        };
    }

    var paymentAccountTemplate = template($('#account-row-template').html());
    function paymentAccountList(e) {
        var $overlay = payments.getOverlay('account-list');
        var $overlay_section = $overlay.children('.account-list').first();

        $.getJSON($overlay_section.data('accounts-url'), function(data) {
            $overlay_section.removeClass('loading');
            var $table = $overlay_section.children('table');
            if (data.length) {
                for (var acc = 0; acc < data.length; acc++) {
                    var account = data[acc];
                    $table.append(paymentAccountTemplate(account));
                }
            } else {
                var $none = $('<div>');
                $none.text(gettext('You do not currently have any payment accounts.'));
                $none.insertBefore($table);
                $table.remove();
            }

            $overlay_section.on('click', 'a.delete-account', _pd(function() {
                var parent = $(this).closest('tr');
                var app_names = parent.data('app-names');
                var delete_url = parent.data('delete-url');
                if (app_names === '') {
                    parent.remove();
                    $.post(delete_url).then(refreshAccountForm);
                } else {
                    confirmPaymentAccountDeletion({
                        'app-names': app_names,
                        'delete-url': delete_url,
                        'name': parent.data('account-name')
                    });
                }
            })).on('click', '.modify-account', _pd(function() {
                // Get the account URL from the table row and pass it to
                // the function to handle the Edit overlay.
                editBangoPaymentAccount($(this).closest('tr').data('account-url'))();
            })).on('click', '.accept-tos', _pd(function() {
                showAgreement({'agreement-url': $(this).closest('tr').data('agreement-url')});
            })).on('click', '.portal-account', _pd(function() {
                var $this = $(this);
                portalRedirect({
                    'portal-url': $this.closest('tr').data('portal-url'),
                    'el': $this
                });
            }));
        });
    }

    function init() {
        z.body.on('click', '.add-payment-account', _pd(newBangoPaymentAccount));
        z.body.on('click', '#payment-account-action', _pd(paymentAccountList));
    }

    return {init: init};
});
