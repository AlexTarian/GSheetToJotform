(function () {
  const DEFAULT_ACTION = 'lookupcase';

  let widgetSettings = {};

  JFCustomWidget.subscribe('ready', async function () {
    try {
      bindEvents_(); // move this FIRST

      setStatus_('ready', 'Ready', 'Enter a search key and click Search.');

      widgetSettings = normalizeSettings_(await getWidgetSettings_());

      configureMode_(widgetSettings.mode);

      const autoCaseNumber = getCaseNumberFromUrl_(widgetSettings.keyParamName);

      if (autoCaseNumber) {
        document.getElementById('caseInput').value = autoCaseNumber;
        await runLookup_(autoCaseNumber);
      }

    } catch (err) {
      console.error(err);
      setStatus_('error', 'Widget error', getErrorMessage_(err));
   }
  });

 let eventsBound = false;

function bindEvents_() {
  if (eventsBound) return;
  eventsBound = true;

  const searchBtn = document.getElementById('searchBtn');
  const caseInput = document.getElementById('caseInput');

  if (!searchBtn || !caseInput) {
    console.error('Missing search button or case input.');
    return;
  }

  searchBtn.addEventListener('click', async function () {
    console.log('Search clicked');

    const caseNumber = clean_(caseInput.value);

    if (!caseNumber) {
      setStatus_('warning', 'Missing Key', 'Enter a key before searching.');
      return;
    }

    await runLookup_(caseNumber);
  });

  caseInput.addEventListener('keydown', async function (event) {
    if (event.key === 'Enter') {
      event.preventDefault();
      searchBtn.click();
    }
  });
}

  async function runLookup_(caseNumber) {
    try {
      const lookupEndpoint = clean_(widgetSettings.lookupEndpoint);
      const token = clean_(widgetSettings.token);

      if (!lookupEndpoint) {
        setStatus_('error', 'Missing lookup endpoint', 'Add the Apps Script web app URL in the widget settings.');
        return;
      }

      if (!token) {
        setStatus_('error', 'Missing token', 'Add the lookup token in the widget settings.');
        return;
      }

      setLoading_(true);
      setStatus_('loading', 'Searching...', `Looking up case ${caseNumber}.`);

      const lookupUrl = buildLookupUrl_(lookupEndpoint, {
        action: DEFAULT_ACTION,
        caseNumber,
        token
      });

      console.log('Lookup URL:', lookupUrl);

      const response = await fetch(lookupUrl, {
        method: 'GET',
        cache: 'no-store'
      });

      if (!response.ok) {
        setStatus_('error', 'Lookup request failed', `Server returned HTTP ${response.status}.`);
        return;
      }

      const data = await response.json();

      if (!data || !data.ok) {
        setStatus_('error', 'Key lookup failed', data && data.error ? data.error : 'Unknown lookup error.');
        return;
      }

      if (!Array.isArray(data.fields) || data.fields.length === 0) {
        setStatus_(
          'warning',
          'Row found, but no fields returned',
          `Row ${data.caseNumber || caseNumber} was found, but no mapped values were returned.`
        );
        return;
      }

      JFCustomWidget.setFieldsValueByLabel(data.fields);

      setStatus_(
        'success',
        'Data Loaded Successfully',
        `Loaded ${data.fields.length} field${data.fields.length === 1 ? '' : 's'} for case ${data.caseNumber || caseNumber}.`
      );

    } catch (err) {
      console.error(err);
      setStatus_('error', 'Lookup error', getErrorMessage_(err));
    } finally {
      setLoading_(false);
    }
  }

function getWidgetSettings_() {
  const settings = {
    lookupEndpoint: getSetting_('lookupEndpoint'),
    token: getSetting_('token'),
    keyParamName: getSetting_('keyParamName') || 'caseNumber',
    mode: getSetting_('mode') || 'manual'
  };

  console.log('Widget settings:', settings);
  return Promise.resolve(settings);
}

function getSetting_(name) {
  try {
    const value = JFCustomWidget.getWidgetSetting(name);
    console.log(`Setting ${name}:`, value);
    return clean_(value);
  } catch (err) {
    console.warn(`Could not read setting ${name}:`, err);
    return '';
  }
}

  function normalizeSettings_(settings) {
    return {
      lookupEndpoint: clean_(settings.lookupEndpoint),
      token: clean_(settings.token),
      keyParamName: clean_(settings.keyParamName) || 'caseNumber',
      mode: clean_(settings.mode).toLowerCase() || 'manual'
    };
  }

  function configureMode_(mode) {
    const inputSection = document.getElementById('inputSection');

    if (mode === 'auto' || mode === 'hidden') {
      inputSection.classList.add('hidden');
    } else {
      inputSection.classList.remove('hidden');
    }

  }

  function getCaseNumberFromUrl_(preferredParamName) {
    return (
      getQueryParam_(preferredParamName) ||
      getQueryParam_('caseNumber') ||
      getQueryParam_('case') ||
      getQueryParam_('caseNum')
    );
  }

  function getQueryParam_(name) {
    if (!name) return '';

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

  function setLoading_(isLoading) {
    const searchBtn = document.getElementById('searchBtn');
    const caseInput = document.getElementById('caseInput');
    const buttonText = document.getElementById('buttonText');
    const buttonSpinner = document.getElementById('buttonSpinner');

    searchBtn.disabled = isLoading;
    caseInput.disabled = isLoading;

    buttonText.textContent = isLoading ? 'Searching' : 'Search';
    buttonSpinner.classList.toggle('hidden', !isLoading);
  }

  function setStatus_(type, title, message) {
    const shell = document.getElementById('widgetShell');
    const icon = document.getElementById('statusIcon');
    const titleEl = document.getElementById('statusTitle');
    const messageEl = document.getElementById('statusMessage');

    shell.className = `widget-shell ${type || ''}`;

    const icons = {
      ready: 'ℹ️',
      loading: '⏳',
      success: '✅',
      warning: '⚠️',
      error: '❌'
    };

    icon.textContent = icons[type] || 'ℹ️';
    titleEl.textContent = title || '';
    messageEl.textContent = message || '';

  }

  function clean_(value) {
    return String(value || '').trim();
  }

  function getErrorMessage_(err) {
    return err && err.message ? err.message : String(err);
  }
})();
