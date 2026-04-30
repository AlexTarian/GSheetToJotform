(function () {
  const DEFAULT_ACTION = 'lookupcase';

  JFCustomWidget.subscribe('ready', async function () {
    try {
      setStatus('loading', 'Loading case data...', 'Please wait while employer data is retrieved.');

      const settings = await getWidgetSettings_();

      const lookupEndpoint = clean_(settings.lookupEndpoint);
      const token = clean_(settings.token);
      const caseParamName = clean_(settings.caseParamName) || 'caseNumber';

      const caseNumber = getQueryParam_(caseParamName) || getQueryParam_('case') || getQueryParam_('caseNumber');

      if (!lookupEndpoint) {
        setStatus('error', 'Missing lookup endpoint', 'Add the Apps Script web app URL in the widget settings.');
        return;
      }

      if (!token) {
        setStatus('error', 'Missing token', 'Add the lookup token in the widget settings.');
        return;
      }

      if (!caseNumber) {
        setStatus('warning', 'No case number found', `Expected a URL parameter named "${caseParamName}".`);
        return;
      }

      const lookupUrl = buildLookupUrl_(lookupEndpoint, {
        action: DEFAULT_ACTION,
        caseNumber,
        token
      });

      const response = await fetch(lookupUrl, {
        method: 'GET',
        cache: 'no-store'
      });

      if (!response.ok) {
        setStatus('error', 'Lookup request failed', `Server returned HTTP ${response.status}.`);
        return;
      }

      const data = await response.json();

      if (!data || !data.ok) {
        setStatus('error', 'Case lookup failed', data && data.error ? data.error : 'Unknown lookup error.');
        return;
      }

      if (!Array.isArray(data.fields) || data.fields.length === 0) {
        setStatus('warning', 'Case found, but no fields returned', `Case ${caseNumber} was found, but no mapped values were returned.`);
        return;
      }

      JFCustomWidget.setFieldsValueByLabel(data.fields);

      setStatus(
        'success',
        'Employer data loaded',
        `Loaded ${data.fields.length} field${data.fields.length === 1 ? '' : 's'} for case ${data.caseNumber || caseNumber}.`
      );

      JFCustomWidget.sendSubmit({
        valid: true,
        value: data.caseNumber || caseNumber
      });

    } catch (err) {
      console.error(err);
      setStatus('error', 'Widget error', err && err.message ? err.message : String(err));
    }
  });

  function getWidgetSettings_() {
    return new Promise(function (resolve) {
      JFCustomWidget.getWidgetSettings(function (settings) {
        resolve(settings || {});
      });
    });
  }

  function getQueryParam_(name) {
    const params = new URLSearchParams(window.location.search);
    return clean_(params.get(name));
  }

  function buildLookupUrl_(baseUrl, params) {
    const url = new URL(baseUrl);

    Object.keys(params).forEach(function (key) {
      url.searchParams.set(key, params[key]);
    });

    return url.toString();
  }

  function clean_(value) {
    return String(value || '').trim();
  }

  function setStatus(type, title, message) {
    const shell = document.querySelector('.widget-shell');
    const icon = document.getElementById('statusIcon');
    const titleEl = document.getElementById('statusTitle');
    const messageEl = document.getElementById('statusMessage');

    shell.className = `widget-shell ${type || ''}`;

    const icons = {
      loading: '⏳',
      success: '✅',
      warning: '⚠️',
      error: '❌'
    };

    icon.textContent = icons[type] || 'ℹ️';
    titleEl.textContent = title || '';
    messageEl.textContent = message || '';

    JFCustomWidget.requestFrameResize();
  }
})();
