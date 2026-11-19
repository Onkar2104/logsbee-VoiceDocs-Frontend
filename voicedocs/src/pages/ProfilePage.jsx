import { useEffect, useState } from 'react'
import { Save, Settings } from 'lucide-react'
import { useAuth } from '../context/useAuth'
import WorkspaceSidebar from '../components/WorkspaceSidebar'
import { fetchUserPreferences, updateUserPreferences } from '../features/current-user/preferencesApi'
import { fetchCurrentUser } from '../features/current-user/currentUserApi'
import { requestAccountTwoFactorOtp, verifyAccountTwoFactorOtp, disableAccountTwoFactor } from '../lib/logsbeeApi'
import { SUPPORTED_LANGUAGES } from '../features/current-user/languages'

function Detail({ label, value }) {
  return <article className="profile-detail-card"><span>{label}</span><strong>{value || 'Not provided'}</strong></article>
}

export default function ProfilePage() {
  const { user } = useAuth()
 
  const [accountUser, setAccountUser] = useState(user)
  const [tab, setTab] = useState('profile')
  const [language, setLanguage] = useState('en')
  const [jurisdictionCountry, setJurisdictionCountry] = useState('IN')
  const [automaticBackup, setAutomaticBackup] = useState(true)
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false)
  const [twoFactorOtp, setTwoFactorOtp] = useState('')
  const [twoFactorStep, setTwoFactorStep] = useState('idle')
  const [twoFactorBusy, setTwoFactorBusy] = useState(false)
  const [isLoadingPreferences, setIsLoadingPreferences] = useState(true)
  const [isSavingPreferences, setIsSavingPreferences] = useState(false)
  const [preferencesError, setPreferencesError] = useState('')
  const [preferencesNotice, setPreferencesNotice] = useState('')
  const [backupError, setBackupError] = useState('')
  const [backupNotice, setBackupNotice] = useState('')
  const [isSavingBackup, setIsSavingBackup] = useState(false)
  const [securityError, setSecurityError] = useState('')
  const [securityNotice, setSecurityNotice] = useState('')
  const [isLoadingAccount, setIsLoadingAccount] = useState(true)

  useEffect(() => {
    let active = true
    fetchCurrentUser()
      .then((freshUser) => {
        if (!active) return
        setAccountUser(freshUser)
        setTwoFactorEnabled(Boolean(freshUser.is_two_factor_authenticated))
      })
      .catch(() => { if (active) setAccountUser(user) })
      .finally(() => { if (active) setIsLoadingAccount(false) })
    fetchUserPreferences()
      .then((preferences) => {
        if (active) {
          setLanguage(preferences.default_language || preferences.transcription_language || 'en')
          setJurisdictionCountry(preferences.jurisdiction_country || 'IN')
          setAutomaticBackup(preferences.automatic_backup_enabled !== false)
        }
      })
      .catch((requestError) => {
        if (active) setPreferencesError(requestError.response?.data?.detail || 'Could not load your default language.')
      })
      .finally(() => { if (active) setIsLoadingPreferences(false) })
    return () => { active = false }
  }, [user])

  async function handleSaveLanguage(event) {
    event.preventDefault()
    setIsSavingPreferences(true)
    setPreferencesError('')
    setPreferencesNotice('')
    try {
      const updated = await updateUserPreferences({ default_language: language, jurisdiction_country: jurisdictionCountry })
      setLanguage(updated.default_language || updated.transcription_language || language)
      setJurisdictionCountry(updated.jurisdiction_country || jurisdictionCountry)
      setPreferencesNotice('Your default language and legal jurisdiction country have been saved.')
    } catch (requestError) {
      setPreferencesError(requestError.response?.data?.detail || 'Could not save your default language.')
    } finally {
      setIsSavingPreferences(false)
    }
  }


  async function handleSaveBackup(event) {
    event.preventDefault()
    setIsSavingBackup(true)
    setBackupError('')
    setBackupNotice('')
    try {
      const updated = await updateUserPreferences({ automatic_backup_enabled: automaticBackup })
      setAutomaticBackup(updated.automatic_backup_enabled !== false)
      setBackupNotice('Your Google Drive backup preference has been saved.')
    } catch (requestError) {
      setBackupError(requestError.response?.data?.detail || 'Could not save your Google Drive backup preference.')
    } finally {
      setIsSavingBackup(false)
    }
  }

  async function refreshAccountSecurity() {
    const freshUser = await fetchCurrentUser()
    setAccountUser(freshUser)
    setTwoFactorEnabled(Boolean(freshUser.is_two_factor_authenticated))
  }

  async function handleRequestTwoFactorOtp() {
    setTwoFactorBusy(true)
    setSecurityError('')
    setSecurityNotice('')
    try {
      await requestAccountTwoFactorOtp()
      setTwoFactorStep('verify')
      setSecurityNotice('A six-digit verification code has been sent to your registered email.')
    } catch (requestError) {
      setSecurityError(requestError.response?.data?.detail || 'Could not send the verification code.')
    } finally {
      setTwoFactorBusy(false)
    }
  }

  async function handleVerifyTwoFactorOtp(event) {
    event.preventDefault()
    setTwoFactorBusy(true)
    setSecurityError('')
    setSecurityNotice('')
    try {
      await verifyAccountTwoFactorOtp(twoFactorOtp)
      await refreshAccountSecurity()
      setTwoFactorOtp('')
      setTwoFactorStep('idle')
      setSecurityNotice('Two-factor authentication is now enabled.')
    } catch (requestError) {
      setSecurityError(requestError.response?.data?.detail || 'Could not verify the code.')
    } finally {
      setTwoFactorBusy(false)
    }
  }

  async function handleDisableTwoFactor() {
    setTwoFactorBusy(true)
    setSecurityError('')
    setSecurityNotice('')
    try {
      await disableAccountTwoFactor()
      await refreshAccountSecurity()
      setTwoFactorStep('idle')
      setSecurityNotice('Two-factor authentication has been disabled.')
    } catch (requestError) {
      setSecurityError(requestError.response?.data?.detail || 'Could not disable two-factor authentication.')
    } finally {
      setTwoFactorBusy(false)
    }
  }

  const profileUser = accountUser || user
  const fullName = [profileUser?.first_name, profileUser?.last_name].filter(Boolean).join(' ')
  const account = profileUser?.account || {}
  return (
    <main className="workspace-with-sidebar">
      <WorkspaceSidebar />
      <section className="workspace-page">
        <header className="workspace-page-heading"><h1>Profile &amp; Settings</h1><p>Manage your personal information, organization details, language, security and backup preferences.</p></header>
        <div className="profile-tabs" role="tablist" aria-label="Profile sections">
          <button type="button" role="tab" aria-selected={tab === 'profile'} className={`profile-tab ${tab === 'profile' ? 'active' : ''}`} onClick={() => setTab('profile')}>Personal details</button>
          <button type="button" role="tab" aria-selected={tab === 'settings'} className={`profile-tab ${tab === 'settings' ? 'active' : ''}`} onClick={() => setTab('settings')}><Settings size={14} /> Settings</button>
        </div>
        {tab === 'profile' ? (
          <>
            <h2 className="profile-section-title">Your details</h2>
            <div className="profile-details-grid">
              <Detail label="Full name" value={fullName} />
              <Detail label="Email address" value={profileUser?.email} />
              <Detail label="Contact number" value={profileUser?.contact} />
              <Detail label="Role" value={profileUser?.role?.name} />
              <Detail label="Email verification" value={profileUser?.is_email_verified ? 'Verified' : 'Not verified'} />
              <Detail label="Contact verification" value={profileUser?.is_contact_verified ? 'Verified' : 'Not verified'} />
            </div>
            <h2 className="profile-section-title organization-section-title">Organization details</h2>
            <div className="profile-details-grid">
              <Detail label="Organization" value={account.name} />
              <Detail label="Organization email" value={account.email} />
              <Detail label="Organization contact" value={account.contact} />
              <Detail label="Address" value={account.address} />
            </div>
          </>
        ) : (
          <>
            <h2 className="profile-section-title">Speech and dictation</h2>
            <form className="settings-card profile-language-settings" onSubmit={handleSaveLanguage}>
              <div className="speech-settings-intro">
                <span className="speech-settings-icon"><Settings size={19} /></span>
                <div><h3>Personalize voice input</h3><p>Choose the language VoiceDocs should select automatically whenever you create or open a document.</p></div>
              </div>
              <label htmlFor="profile-default-transcription-language">Your default language</label>
              <select id="profile-default-transcription-language" value={language} onChange={(event) => setLanguage(event.target.value)} disabled={isLoadingPreferences || isSavingPreferences}>
                {SUPPORTED_LANGUAGES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
              <div className="speech-settings-note"><strong>Good to know</strong><span>You can change the language at any time inside a document. That temporary choice will not overwrite your saved default.</span></div>
              {preferencesError && <p className="alert alert-error" role="alert">{preferencesError}</p>}
              {preferencesNotice && <p className="alert alert-success" role="status">{preferencesNotice}</p>}
              <div className="settings-actions">
                <button className="primary-button save-button" type="submit" disabled={isLoadingPreferences || isSavingPreferences}>
                  <Save size={16} /> {isSavingPreferences ? 'Saving preferences…' : 'Save preferences'}
                </button>
              </div>
            </form>
            <h2 className="profile-section-title">Legal document jurisdiction</h2>
            <form className="settings-card profile-language-settings" onSubmit={handleSaveLanguage}>
              <div className="speech-settings-intro"><span className="speech-settings-icon"><Settings size={19} /></span><div><h3>Default country for legal documents</h3><p>Choose the country whose jurisdiction should be selected by default when creating a legal document.</p></div></div>
              <label htmlFor="profile-jurisdiction-country">Country</label>
              <select id="profile-jurisdiction-country" value={jurisdictionCountry} onChange={(event) => setJurisdictionCountry(event.target.value)} disabled={isLoadingPreferences || isSavingPreferences}>
                  <option value="AD">{new Intl.DisplayNames(['en'], { type: 'region' }).of('AD')}</option>
                  <option value="AE">{new Intl.DisplayNames(['en'], { type: 'region' }).of('AE')}</option>
                  <option value="AF">{new Intl.DisplayNames(['en'], { type: 'region' }).of('AF')}</option>
                  <option value="AG">{new Intl.DisplayNames(['en'], { type: 'region' }).of('AG')}</option>
                  <option value="AI">{new Intl.DisplayNames(['en'], { type: 'region' }).of('AI')}</option>
                  <option value="AL">{new Intl.DisplayNames(['en'], { type: 'region' }).of('AL')}</option>
                  <option value="AM">{new Intl.DisplayNames(['en'], { type: 'region' }).of('AM')}</option>
                  <option value="AO">{new Intl.DisplayNames(['en'], { type: 'region' }).of('AO')}</option>
                  <option value="AQ">{new Intl.DisplayNames(['en'], { type: 'region' }).of('AQ')}</option>
                  <option value="AR">{new Intl.DisplayNames(['en'], { type: 'region' }).of('AR')}</option>
                  <option value="AS">{new Intl.DisplayNames(['en'], { type: 'region' }).of('AS')}</option>
                  <option value="AT">{new Intl.DisplayNames(['en'], { type: 'region' }).of('AT')}</option>
                  <option value="AU">{new Intl.DisplayNames(['en'], { type: 'region' }).of('AU')}</option>
                  <option value="AW">{new Intl.DisplayNames(['en'], { type: 'region' }).of('AW')}</option>
                  <option value="AX">{new Intl.DisplayNames(['en'], { type: 'region' }).of('AX')}</option>
                  <option value="AZ">{new Intl.DisplayNames(['en'], { type: 'region' }).of('AZ')}</option>
                  <option value="BA">{new Intl.DisplayNames(['en'], { type: 'region' }).of('BA')}</option>
                  <option value="BB">{new Intl.DisplayNames(['en'], { type: 'region' }).of('BB')}</option>
                  <option value="BD">{new Intl.DisplayNames(['en'], { type: 'region' }).of('BD')}</option>
                  <option value="BE">{new Intl.DisplayNames(['en'], { type: 'region' }).of('BE')}</option>
                  <option value="BF">{new Intl.DisplayNames(['en'], { type: 'region' }).of('BF')}</option>
                  <option value="BG">{new Intl.DisplayNames(['en'], { type: 'region' }).of('BG')}</option>
                  <option value="BH">{new Intl.DisplayNames(['en'], { type: 'region' }).of('BH')}</option>
                  <option value="BI">{new Intl.DisplayNames(['en'], { type: 'region' }).of('BI')}</option>
                  <option value="BJ">{new Intl.DisplayNames(['en'], { type: 'region' }).of('BJ')}</option>
                  <option value="BL">{new Intl.DisplayNames(['en'], { type: 'region' }).of('BL')}</option>
                  <option value="BM">{new Intl.DisplayNames(['en'], { type: 'region' }).of('BM')}</option>
                  <option value="BN">{new Intl.DisplayNames(['en'], { type: 'region' }).of('BN')}</option>
                  <option value="BO">{new Intl.DisplayNames(['en'], { type: 'region' }).of('BO')}</option>
                  <option value="BQ">{new Intl.DisplayNames(['en'], { type: 'region' }).of('BQ')}</option>
                  <option value="BR">{new Intl.DisplayNames(['en'], { type: 'region' }).of('BR')}</option>
                  <option value="BS">{new Intl.DisplayNames(['en'], { type: 'region' }).of('BS')}</option>
                  <option value="BT">{new Intl.DisplayNames(['en'], { type: 'region' }).of('BT')}</option>
                  <option value="BV">{new Intl.DisplayNames(['en'], { type: 'region' }).of('BV')}</option>
                  <option value="BW">{new Intl.DisplayNames(['en'], { type: 'region' }).of('BW')}</option>
                  <option value="BY">{new Intl.DisplayNames(['en'], { type: 'region' }).of('BY')}</option>
                  <option value="BZ">{new Intl.DisplayNames(['en'], { type: 'region' }).of('BZ')}</option>
                  <option value="CA">{new Intl.DisplayNames(['en'], { type: 'region' }).of('CA')}</option>
                  <option value="CC">{new Intl.DisplayNames(['en'], { type: 'region' }).of('CC')}</option>
                  <option value="CD">{new Intl.DisplayNames(['en'], { type: 'region' }).of('CD')}</option>
                  <option value="CF">{new Intl.DisplayNames(['en'], { type: 'region' }).of('CF')}</option>
                  <option value="CG">{new Intl.DisplayNames(['en'], { type: 'region' }).of('CG')}</option>
                  <option value="CH">{new Intl.DisplayNames(['en'], { type: 'region' }).of('CH')}</option>
                  <option value="CI">{new Intl.DisplayNames(['en'], { type: 'region' }).of('CI')}</option>
                  <option value="CK">{new Intl.DisplayNames(['en'], { type: 'region' }).of('CK')}</option>
                  <option value="CL">{new Intl.DisplayNames(['en'], { type: 'region' }).of('CL')}</option>
                  <option value="CM">{new Intl.DisplayNames(['en'], { type: 'region' }).of('CM')}</option>
                  <option value="CN">{new Intl.DisplayNames(['en'], { type: 'region' }).of('CN')}</option>
                  <option value="CO">{new Intl.DisplayNames(['en'], { type: 'region' }).of('CO')}</option>
                  <option value="CR">{new Intl.DisplayNames(['en'], { type: 'region' }).of('CR')}</option>
                  <option value="CU">{new Intl.DisplayNames(['en'], { type: 'region' }).of('CU')}</option>
                  <option value="CV">{new Intl.DisplayNames(['en'], { type: 'region' }).of('CV')}</option>
                  <option value="CW">{new Intl.DisplayNames(['en'], { type: 'region' }).of('CW')}</option>
                  <option value="CX">{new Intl.DisplayNames(['en'], { type: 'region' }).of('CX')}</option>
                  <option value="CY">{new Intl.DisplayNames(['en'], { type: 'region' }).of('CY')}</option>
                  <option value="CZ">{new Intl.DisplayNames(['en'], { type: 'region' }).of('CZ')}</option>
                  <option value="DE">{new Intl.DisplayNames(['en'], { type: 'region' }).of('DE')}</option>
                  <option value="DJ">{new Intl.DisplayNames(['en'], { type: 'region' }).of('DJ')}</option>
                  <option value="DK">{new Intl.DisplayNames(['en'], { type: 'region' }).of('DK')}</option>
                  <option value="DM">{new Intl.DisplayNames(['en'], { type: 'region' }).of('DM')}</option>
                  <option value="DO">{new Intl.DisplayNames(['en'], { type: 'region' }).of('DO')}</option>
                  <option value="DZ">{new Intl.DisplayNames(['en'], { type: 'region' }).of('DZ')}</option>
                  <option value="EC">{new Intl.DisplayNames(['en'], { type: 'region' }).of('EC')}</option>
                  <option value="EE">{new Intl.DisplayNames(['en'], { type: 'region' }).of('EE')}</option>
                  <option value="EG">{new Intl.DisplayNames(['en'], { type: 'region' }).of('EG')}</option>
                  <option value="EH">{new Intl.DisplayNames(['en'], { type: 'region' }).of('EH')}</option>
                  <option value="ER">{new Intl.DisplayNames(['en'], { type: 'region' }).of('ER')}</option>
                  <option value="ES">{new Intl.DisplayNames(['en'], { type: 'region' }).of('ES')}</option>
                  <option value="ET">{new Intl.DisplayNames(['en'], { type: 'region' }).of('ET')}</option>
                  <option value="FI">{new Intl.DisplayNames(['en'], { type: 'region' }).of('FI')}</option>
                  <option value="FJ">{new Intl.DisplayNames(['en'], { type: 'region' }).of('FJ')}</option>
                  <option value="FK">{new Intl.DisplayNames(['en'], { type: 'region' }).of('FK')}</option>
                  <option value="FM">{new Intl.DisplayNames(['en'], { type: 'region' }).of('FM')}</option>
                  <option value="FO">{new Intl.DisplayNames(['en'], { type: 'region' }).of('FO')}</option>
                  <option value="FR">{new Intl.DisplayNames(['en'], { type: 'region' }).of('FR')}</option>
                  <option value="GA">{new Intl.DisplayNames(['en'], { type: 'region' }).of('GA')}</option>
                  <option value="GB">{new Intl.DisplayNames(['en'], { type: 'region' }).of('GB')}</option>
                  <option value="GD">{new Intl.DisplayNames(['en'], { type: 'region' }).of('GD')}</option>
                  <option value="GE">{new Intl.DisplayNames(['en'], { type: 'region' }).of('GE')}</option>
                  <option value="GF">{new Intl.DisplayNames(['en'], { type: 'region' }).of('GF')}</option>
                  <option value="GG">{new Intl.DisplayNames(['en'], { type: 'region' }).of('GG')}</option>
                  <option value="GH">{new Intl.DisplayNames(['en'], { type: 'region' }).of('GH')}</option>
                  <option value="GI">{new Intl.DisplayNames(['en'], { type: 'region' }).of('GI')}</option>
                  <option value="GL">{new Intl.DisplayNames(['en'], { type: 'region' }).of('GL')}</option>
                  <option value="GM">{new Intl.DisplayNames(['en'], { type: 'region' }).of('GM')}</option>
                  <option value="GN">{new Intl.DisplayNames(['en'], { type: 'region' }).of('GN')}</option>
                  <option value="GP">{new Intl.DisplayNames(['en'], { type: 'region' }).of('GP')}</option>
                  <option value="GQ">{new Intl.DisplayNames(['en'], { type: 'region' }).of('GQ')}</option>
                  <option value="GR">{new Intl.DisplayNames(['en'], { type: 'region' }).of('GR')}</option>
                  <option value="GS">{new Intl.DisplayNames(['en'], { type: 'region' }).of('GS')}</option>
                  <option value="GT">{new Intl.DisplayNames(['en'], { type: 'region' }).of('GT')}</option>
                  <option value="GU">{new Intl.DisplayNames(['en'], { type: 'region' }).of('GU')}</option>
                  <option value="GW">{new Intl.DisplayNames(['en'], { type: 'region' }).of('GW')}</option>
                  <option value="GY">{new Intl.DisplayNames(['en'], { type: 'region' }).of('GY')}</option>
                  <option value="HK">{new Intl.DisplayNames(['en'], { type: 'region' }).of('HK')}</option>
                  <option value="HM">{new Intl.DisplayNames(['en'], { type: 'region' }).of('HM')}</option>
                  <option value="HN">{new Intl.DisplayNames(['en'], { type: 'region' }).of('HN')}</option>
                  <option value="HR">{new Intl.DisplayNames(['en'], { type: 'region' }).of('HR')}</option>
                  <option value="HT">{new Intl.DisplayNames(['en'], { type: 'region' }).of('HT')}</option>
                  <option value="HU">{new Intl.DisplayNames(['en'], { type: 'region' }).of('HU')}</option>
                  <option value="ID">{new Intl.DisplayNames(['en'], { type: 'region' }).of('ID')}</option>
                  <option value="IE">{new Intl.DisplayNames(['en'], { type: 'region' }).of('IE')}</option>
                  <option value="IL">{new Intl.DisplayNames(['en'], { type: 'region' }).of('IL')}</option>
                  <option value="IM">{new Intl.DisplayNames(['en'], { type: 'region' }).of('IM')}</option>
                  <option value="IN">{new Intl.DisplayNames(['en'], { type: 'region' }).of('IN')}</option>
                  <option value="IO">{new Intl.DisplayNames(['en'], { type: 'region' }).of('IO')}</option>
                  <option value="IQ">{new Intl.DisplayNames(['en'], { type: 'region' }).of('IQ')}</option>
                  <option value="IR">{new Intl.DisplayNames(['en'], { type: 'region' }).of('IR')}</option>
                  <option value="IS">{new Intl.DisplayNames(['en'], { type: 'region' }).of('IS')}</option>
                  <option value="IT">{new Intl.DisplayNames(['en'], { type: 'region' }).of('IT')}</option>
                  <option value="JE">{new Intl.DisplayNames(['en'], { type: 'region' }).of('JE')}</option>
                  <option value="JM">{new Intl.DisplayNames(['en'], { type: 'region' }).of('JM')}</option>
                  <option value="JO">{new Intl.DisplayNames(['en'], { type: 'region' }).of('JO')}</option>
                  <option value="JP">{new Intl.DisplayNames(['en'], { type: 'region' }).of('JP')}</option>
                  <option value="KE">{new Intl.DisplayNames(['en'], { type: 'region' }).of('KE')}</option>
                  <option value="KG">{new Intl.DisplayNames(['en'], { type: 'region' }).of('KG')}</option>
                  <option value="KH">{new Intl.DisplayNames(['en'], { type: 'region' }).of('KH')}</option>
                  <option value="KI">{new Intl.DisplayNames(['en'], { type: 'region' }).of('KI')}</option>
                  <option value="KM">{new Intl.DisplayNames(['en'], { type: 'region' }).of('KM')}</option>
                  <option value="KN">{new Intl.DisplayNames(['en'], { type: 'region' }).of('KN')}</option>
                  <option value="KP">{new Intl.DisplayNames(['en'], { type: 'region' }).of('KP')}</option>
                  <option value="KR">{new Intl.DisplayNames(['en'], { type: 'region' }).of('KR')}</option>
                  <option value="KW">{new Intl.DisplayNames(['en'], { type: 'region' }).of('KW')}</option>
                  <option value="KY">{new Intl.DisplayNames(['en'], { type: 'region' }).of('KY')}</option>
                  <option value="KZ">{new Intl.DisplayNames(['en'], { type: 'region' }).of('KZ')}</option>
                  <option value="LA">{new Intl.DisplayNames(['en'], { type: 'region' }).of('LA')}</option>
                  <option value="LB">{new Intl.DisplayNames(['en'], { type: 'region' }).of('LB')}</option>
                  <option value="LC">{new Intl.DisplayNames(['en'], { type: 'region' }).of('LC')}</option>
                  <option value="LI">{new Intl.DisplayNames(['en'], { type: 'region' }).of('LI')}</option>
                  <option value="LK">{new Intl.DisplayNames(['en'], { type: 'region' }).of('LK')}</option>
                  <option value="LR">{new Intl.DisplayNames(['en'], { type: 'region' }).of('LR')}</option>
                  <option value="LS">{new Intl.DisplayNames(['en'], { type: 'region' }).of('LS')}</option>
                  <option value="LT">{new Intl.DisplayNames(['en'], { type: 'region' }).of('LT')}</option>
                  <option value="LU">{new Intl.DisplayNames(['en'], { type: 'region' }).of('LU')}</option>
                  <option value="LV">{new Intl.DisplayNames(['en'], { type: 'region' }).of('LV')}</option>
                  <option value="LY">{new Intl.DisplayNames(['en'], { type: 'region' }).of('LY')}</option>
                  <option value="MA">{new Intl.DisplayNames(['en'], { type: 'region' }).of('MA')}</option>
                  <option value="MC">{new Intl.DisplayNames(['en'], { type: 'region' }).of('MC')}</option>
                  <option value="MD">{new Intl.DisplayNames(['en'], { type: 'region' }).of('MD')}</option>
                  <option value="ME">{new Intl.DisplayNames(['en'], { type: 'region' }).of('ME')}</option>
                  <option value="MF">{new Intl.DisplayNames(['en'], { type: 'region' }).of('MF')}</option>
                  <option value="MG">{new Intl.DisplayNames(['en'], { type: 'region' }).of('MG')}</option>
                  <option value="MH">{new Intl.DisplayNames(['en'], { type: 'region' }).of('MH')}</option>
                  <option value="MK">{new Intl.DisplayNames(['en'], { type: 'region' }).of('MK')}</option>
                  <option value="ML">{new Intl.DisplayNames(['en'], { type: 'region' }).of('ML')}</option>
                  <option value="MM">{new Intl.DisplayNames(['en'], { type: 'region' }).of('MM')}</option>
                  <option value="MN">{new Intl.DisplayNames(['en'], { type: 'region' }).of('MN')}</option>
                  <option value="MO">{new Intl.DisplayNames(['en'], { type: 'region' }).of('MO')}</option>
                  <option value="MP">{new Intl.DisplayNames(['en'], { type: 'region' }).of('MP')}</option>
                  <option value="MQ">{new Intl.DisplayNames(['en'], { type: 'region' }).of('MQ')}</option>
                  <option value="MR">{new Intl.DisplayNames(['en'], { type: 'region' }).of('MR')}</option>
                  <option value="MS">{new Intl.DisplayNames(['en'], { type: 'region' }).of('MS')}</option>
                  <option value="MT">{new Intl.DisplayNames(['en'], { type: 'region' }).of('MT')}</option>
                  <option value="MU">{new Intl.DisplayNames(['en'], { type: 'region' }).of('MU')}</option>
                  <option value="MV">{new Intl.DisplayNames(['en'], { type: 'region' }).of('MV')}</option>
                  <option value="MW">{new Intl.DisplayNames(['en'], { type: 'region' }).of('MW')}</option>
                  <option value="MX">{new Intl.DisplayNames(['en'], { type: 'region' }).of('MX')}</option>
                  <option value="MY">{new Intl.DisplayNames(['en'], { type: 'region' }).of('MY')}</option>
                  <option value="MZ">{new Intl.DisplayNames(['en'], { type: 'region' }).of('MZ')}</option>
                  <option value="NA">{new Intl.DisplayNames(['en'], { type: 'region' }).of('NA')}</option>
                  <option value="NC">{new Intl.DisplayNames(['en'], { type: 'region' }).of('NC')}</option>
                  <option value="NE">{new Intl.DisplayNames(['en'], { type: 'region' }).of('NE')}</option>
                  <option value="NF">{new Intl.DisplayNames(['en'], { type: 'region' }).of('NF')}</option>
                  <option value="NG">{new Intl.DisplayNames(['en'], { type: 'region' }).of('NG')}</option>
                  <option value="NI">{new Intl.DisplayNames(['en'], { type: 'region' }).of('NI')}</option>
                  <option value="NL">{new Intl.DisplayNames(['en'], { type: 'region' }).of('NL')}</option>
                  <option value="NO">{new Intl.DisplayNames(['en'], { type: 'region' }).of('NO')}</option>
                  <option value="NP">{new Intl.DisplayNames(['en'], { type: 'region' }).of('NP')}</option>
                  <option value="NR">{new Intl.DisplayNames(['en'], { type: 'region' }).of('NR')}</option>
                  <option value="NU">{new Intl.DisplayNames(['en'], { type: 'region' }).of('NU')}</option>
                  <option value="NZ">{new Intl.DisplayNames(['en'], { type: 'region' }).of('NZ')}</option>
                  <option value="OM">{new Intl.DisplayNames(['en'], { type: 'region' }).of('OM')}</option>
                  <option value="PA">{new Intl.DisplayNames(['en'], { type: 'region' }).of('PA')}</option>
                  <option value="PE">{new Intl.DisplayNames(['en'], { type: 'region' }).of('PE')}</option>
                  <option value="PF">{new Intl.DisplayNames(['en'], { type: 'region' }).of('PF')}</option>
                  <option value="PG">{new Intl.DisplayNames(['en'], { type: 'region' }).of('PG')}</option>
                  <option value="PH">{new Intl.DisplayNames(['en'], { type: 'region' }).of('PH')}</option>
                  <option value="PK">{new Intl.DisplayNames(['en'], { type: 'region' }).of('PK')}</option>
                  <option value="PL">{new Intl.DisplayNames(['en'], { type: 'region' }).of('PL')}</option>
                  <option value="PM">{new Intl.DisplayNames(['en'], { type: 'region' }).of('PM')}</option>
                  <option value="PN">{new Intl.DisplayNames(['en'], { type: 'region' }).of('PN')}</option>
                  <option value="PR">{new Intl.DisplayNames(['en'], { type: 'region' }).of('PR')}</option>
                  <option value="PS">{new Intl.DisplayNames(['en'], { type: 'region' }).of('PS')}</option>
                  <option value="PT">{new Intl.DisplayNames(['en'], { type: 'region' }).of('PT')}</option>
                  <option value="PW">{new Intl.DisplayNames(['en'], { type: 'region' }).of('PW')}</option>
                  <option value="PY">{new Intl.DisplayNames(['en'], { type: 'region' }).of('PY')}</option>
                  <option value="QA">{new Intl.DisplayNames(['en'], { type: 'region' }).of('QA')}</option>
                  <option value="RE">{new Intl.DisplayNames(['en'], { type: 'region' }).of('RE')}</option>
                  <option value="RO">{new Intl.DisplayNames(['en'], { type: 'region' }).of('RO')}</option>
                  <option value="RS">{new Intl.DisplayNames(['en'], { type: 'region' }).of('RS')}</option>
                  <option value="RU">{new Intl.DisplayNames(['en'], { type: 'region' }).of('RU')}</option>
                  <option value="RW">{new Intl.DisplayNames(['en'], { type: 'region' }).of('RW')}</option>
                  <option value="SA">{new Intl.DisplayNames(['en'], { type: 'region' }).of('SA')}</option>
                  <option value="SB">{new Intl.DisplayNames(['en'], { type: 'region' }).of('SB')}</option>
                  <option value="SC">{new Intl.DisplayNames(['en'], { type: 'region' }).of('SC')}</option>
                  <option value="SD">{new Intl.DisplayNames(['en'], { type: 'region' }).of('SD')}</option>
                  <option value="SE">{new Intl.DisplayNames(['en'], { type: 'region' }).of('SE')}</option>
                  <option value="SG">{new Intl.DisplayNames(['en'], { type: 'region' }).of('SG')}</option>
                  <option value="SH">{new Intl.DisplayNames(['en'], { type: 'region' }).of('SH')}</option>
                  <option value="SI">{new Intl.DisplayNames(['en'], { type: 'region' }).of('SI')}</option>
                  <option value="SJ">{new Intl.DisplayNames(['en'], { type: 'region' }).of('SJ')}</option>
                  <option value="SK">{new Intl.DisplayNames(['en'], { type: 'region' }).of('SK')}</option>
                  <option value="SL">{new Intl.DisplayNames(['en'], { type: 'region' }).of('SL')}</option>
                  <option value="SM">{new Intl.DisplayNames(['en'], { type: 'region' }).of('SM')}</option>
                  <option value="SN">{new Intl.DisplayNames(['en'], { type: 'region' }).of('SN')}</option>
                  <option value="SO">{new Intl.DisplayNames(['en'], { type: 'region' }).of('SO')}</option>
                  <option value="SR">{new Intl.DisplayNames(['en'], { type: 'region' }).of('SR')}</option>
                  <option value="SS">{new Intl.DisplayNames(['en'], { type: 'region' }).of('SS')}</option>
                  <option value="ST">{new Intl.DisplayNames(['en'], { type: 'region' }).of('ST')}</option>
                  <option value="SV">{new Intl.DisplayNames(['en'], { type: 'region' }).of('SV')}</option>
                  <option value="SX">{new Intl.DisplayNames(['en'], { type: 'region' }).of('SX')}</option>
                  <option value="SY">{new Intl.DisplayNames(['en'], { type: 'region' }).of('SY')}</option>
                  <option value="SZ">{new Intl.DisplayNames(['en'], { type: 'region' }).of('SZ')}</option>
                  <option value="TC">{new Intl.DisplayNames(['en'], { type: 'region' }).of('TC')}</option>
                  <option value="TD">{new Intl.DisplayNames(['en'], { type: 'region' }).of('TD')}</option>
                  <option value="TF">{new Intl.DisplayNames(['en'], { type: 'region' }).of('TF')}</option>
                  <option value="TG">{new Intl.DisplayNames(['en'], { type: 'region' }).of('TG')}</option>
                  <option value="TH">{new Intl.DisplayNames(['en'], { type: 'region' }).of('TH')}</option>
                  <option value="TJ">{new Intl.DisplayNames(['en'], { type: 'region' }).of('TJ')}</option>
                  <option value="TK">{new Intl.DisplayNames(['en'], { type: 'region' }).of('TK')}</option>
                  <option value="TL">{new Intl.DisplayNames(['en'], { type: 'region' }).of('TL')}</option>
                  <option value="TM">{new Intl.DisplayNames(['en'], { type: 'region' }).of('TM')}</option>
                  <option value="TN">{new Intl.DisplayNames(['en'], { type: 'region' }).of('TN')}</option>
                  <option value="TO">{new Intl.DisplayNames(['en'], { type: 'region' }).of('TO')}</option>
                  <option value="TR">{new Intl.DisplayNames(['en'], { type: 'region' }).of('TR')}</option>
                  <option value="TT">{new Intl.DisplayNames(['en'], { type: 'region' }).of('TT')}</option>
                  <option value="TV">{new Intl.DisplayNames(['en'], { type: 'region' }).of('TV')}</option>
                  <option value="TW">{new Intl.DisplayNames(['en'], { type: 'region' }).of('TW')}</option>
                  <option value="TZ">{new Intl.DisplayNames(['en'], { type: 'region' }).of('TZ')}</option>
                  <option value="UA">{new Intl.DisplayNames(['en'], { type: 'region' }).of('UA')}</option>
                  <option value="UG">{new Intl.DisplayNames(['en'], { type: 'region' }).of('UG')}</option>
                  <option value="UM">{new Intl.DisplayNames(['en'], { type: 'region' }).of('UM')}</option>
                  <option value="US">{new Intl.DisplayNames(['en'], { type: 'region' }).of('US')}</option>
                  <option value="UY">{new Intl.DisplayNames(['en'], { type: 'region' }).of('UY')}</option>
                  <option value="UZ">{new Intl.DisplayNames(['en'], { type: 'region' }).of('UZ')}</option>
                  <option value="VA">{new Intl.DisplayNames(['en'], { type: 'region' }).of('VA')}</option>
                  <option value="VC">{new Intl.DisplayNames(['en'], { type: 'region' }).of('VC')}</option>
                  <option value="VE">{new Intl.DisplayNames(['en'], { type: 'region' }).of('VE')}</option>
                  <option value="VG">{new Intl.DisplayNames(['en'], { type: 'region' }).of('VG')}</option>
                  <option value="VI">{new Intl.DisplayNames(['en'], { type: 'region' }).of('VI')}</option>
                  <option value="VN">{new Intl.DisplayNames(['en'], { type: 'region' }).of('VN')}</option>
                  <option value="VU">{new Intl.DisplayNames(['en'], { type: 'region' }).of('VU')}</option>
                  <option value="WF">{new Intl.DisplayNames(['en'], { type: 'region' }).of('WF')}</option>
                  <option value="WS">{new Intl.DisplayNames(['en'], { type: 'region' }).of('WS')}</option>
                  <option value="YE">{new Intl.DisplayNames(['en'], { type: 'region' }).of('YE')}</option>
                  <option value="YT">{new Intl.DisplayNames(['en'], { type: 'region' }).of('YT')}</option>
                  <option value="ZA">{new Intl.DisplayNames(['en'], { type: 'region' }).of('ZA')}</option>
                  <option value="ZM">{new Intl.DisplayNames(['en'], { type: 'region' }).of('ZM')}</option>
                  <option value="ZW">{new Intl.DisplayNames(['en'], { type: 'region' }).of('ZW')}</option>
              </select>
              {jurisdictionCountry !== 'IN' && <p className="settings-warning">India is currently the only country with a complete legal document catalogue in VoiceDocs. Other countries can be saved as your preference, but legal drafting templates for them are not available yet.</p>}
              <div className="settings-actions"><button className="primary-button save-button" type="submit" disabled={isLoadingPreferences || isSavingPreferences}><Save size={16} /> {isSavingPreferences ? 'Saving preferences…' : 'Save country'}</button></div>
            </form>
            <h2 className="profile-section-title">Google Drive &amp; backup</h2>
            <form className="settings-card profile-language-settings" onSubmit={handleSaveBackup}>
              <div className="speech-settings-intro"><span className="speech-settings-icon"><Settings size={19} /></span><div><h3>Automatic backup</h3><p>Keep your documents and audio backed up to your connected Google Drive.</p></div></div>
              <div className="speech-backup-option">
                <div><strong>Automatic Google Drive backup</strong><span>When enabled, pending files retry when you connect Drive, reopen VoiceDocs or return online. When disabled, you can back up each file manually.</span></div>
                <label className="setting-toggle-label"><input type="checkbox" checked={automaticBackup} onChange={(event) => setAutomaticBackup(event.target.checked)} disabled={isLoadingPreferences || isSavingBackup} aria-label="Enable automatic Google Drive backup" /><span>{automaticBackup ? 'On' : 'Off'}</span></label>
              </div>
              {!automaticBackup && <p className="speech-settings-note">Automatic backup is off. Your files remain in VoiceDocs until you choose manual backup.</p>}
              {backupError && <p className="alert alert-error" role="alert">{backupError}</p>}
              {backupNotice && <p className="alert alert-success" role="status">{backupNotice}</p>}
              <div className="settings-actions"><button className="primary-button save-button" type="submit" disabled={isLoadingPreferences || isSavingBackup}><Save size={16} /> {isSavingBackup ? 'Saving backup setting…' : 'Save backup setting'}</button></div>
            </form>
            <h2 className="profile-section-title">Security & account settings</h2>
            <div className="settings-grid">
              <article className="settings-card">
                <h3>Two-factor authentication</h3>
                <p>Require a one-time code sent to your registered Logsbee email address after password sign-in.</p>
                <div className="setting-control-row two-factor-toggle-row">
                  <span className={`setting-status ${twoFactorEnabled ? 'enabled' : ''}`}>{isLoadingAccount ? 'Checking status…' : twoFactorEnabled ? 'Enabled' : twoFactorStep === 'verify' ? 'Verification pending' : 'Disabled'}</span>
                  <label className="two-factor-switch" aria-label="Enable or disable two-factor authentication">
                    <input
                      type="checkbox"
                      checked={twoFactorEnabled}
                      disabled={twoFactorBusy || isLoadingAccount || (!profileUser?.is_email_verified && !twoFactorEnabled)}
                      onChange={(event) => event.target.checked ? handleRequestTwoFactorOtp() : handleDisableTwoFactor()}
                    />
                    <span className="two-factor-switch-track" />
                  </label>
                </div>
                {twoFactorStep === 'verify' && !twoFactorEnabled && (
                  <form className="two-factor-verify-form" onSubmit={handleVerifyTwoFactorOtp}>
                    <label htmlFor="two-factor-otp">Enter the six-digit code sent to your email</label>
                    <input id="two-factor-otp" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={twoFactorOtp} onChange={(event) => setTwoFactorOtp(event.target.value.replace(/\D/g, '').slice(0, 6))} required />
                    <div className="settings-actions"><button className="primary-button save-button" type="submit" disabled={twoFactorBusy || twoFactorOtp.length !== 6}>{twoFactorBusy ? 'Verifying…' : 'Verify and enable'}</button><button className="secondary-button" type="button" onClick={() => { setTwoFactorStep('idle'); setTwoFactorOtp('') }} disabled={twoFactorBusy}>Cancel</button></div>
                  </form>
                )}
                {securityError && <p className="alert alert-error" role="alert">{securityError}</p>}
                {securityNotice && <p className="alert alert-success" role="status">{securityNotice}</p>}
                {!profileUser?.is_email_verified && <p className="settings-warning">Verify your Logsbee email address before enabling 2FA.</p>}
              </article>
              <article className="settings-card"><h3>Password & recovery</h3><p>Change your password, review recovery options and keep your sign-in details secure.</p><span className="setting-status">Managed by Logsbee User</span></article>
              <article className="settings-card"><h3>Active sessions</h3><p>Review signed-in devices and sign out sessions you no longer use.</p><span className="setting-status">Session management API required</span></article>
              <article className="settings-card"><h3>Notifications</h3><p>Future preferences for document shares, edit requests and account security alerts.</p><span className="setting-status">Coming soon</span></article>
              <article className="settings-card"><h3>Connected applications</h3><p>Manage connected services such as Google Drive.</p><span className="setting-status">Manage in Google Drive</span></article>
              <article className="settings-card settings-danger"><h3>Delete organization account</h3><p>Deleting an organization affects all its members and stored documents. This should require Admin confirmation and a recovery window.</p><span className="setting-status">Deletion API and confirmation flow required</span><button className="danger-outline-button" type="button" disabled title="Organization deletion will be enabled after the secure deletion API is implemented">Delete organization</button></article>
            </div>
            <p className="settings-warning">2FA activation and deactivation are handled by Logsbee. Activation requires a verified email and a successful one-time code.</p>
          </>
        )}
      </section>
    </main>
  )
}
