interface InviteEmailTemplateProps {
  cleanInviter: string;
  cleanTeamName: string;
  formattedRoles: string;
}

export function getInviteEmailTemplate({
  cleanInviter,
  cleanTeamName,
  formattedRoles,
}: InviteEmailTemplateProps): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>Team invitation</title>
  <style type="text/css">
    /* Reset styles */
    body, table, td, p { margin: 0; padding: 0; }
    body { font-family: 'Helvetica', Arial, sans-serif; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table { border-collapse: collapse; }
    img { border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none; }
    
    /* Responsive */
    @media only screen and (max-width: 600px) {
      .container { width: 100% !important; }
      .content { padding: 20px !important; }
      .logo { width: 150px !important; }
      .header-image { width: 100% !important; }
      .button { width: 100% !important; }
    }
  </style>
</head>
<body style="background-color: #e5e5e5; margin: 0; padding: 20px;">
  <!-- Preview text -->
  <div style="display: none; font-size: 1px; color: #ffffff; line-height: 1px; max-height: 0; max-width: 0; opacity: 0; overflow: hidden;">
    <strong>${cleanInviter}</strong> has invited you to join the team <strong>${cleanTeamName}</strong> as <strong>${formattedRoles}</strong>
  </div>

  <!-- Main container -->
  <center>
    <table class="container" style="max-width: 600px; width: 100%; background-color: #f1f0ee; border-radius: 30px; margin: 0 auto;" cellpadding="0" cellspacing="0" border="0">
    <tr>
      <td style="padding: 16px;">
        
        <!-- Logo section -->
        <table style="width: 100%; background-color: #eff1f1; border-radius: 15px;" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td style="padding: 24px; text-align: center;">
              <img src="https://e.hypermatic.com/a2c697bae8735119d7d3c4babdae6e40.png" alt="Logo" class="logo" style="width: 200px; height: auto;">
            </td>
          </tr>
        </table>

        <!-- Spacer -->
        <div style="height: 16px;"></div>

        <!-- Main content -->
        <table style="width: 100%; background-color: #fafaf9; border-radius: 30px;" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td style="padding: 0;">
              <!-- Header image -->
              <img src="https://e.hypermatic.com/a67ffe6057d96f0e74be2f238856ce48.png" alt="Header" class="header-image" style="width: 100%; height: auto; border-radius: 30px 30px 0 0; display: block;">
            </td>
          </tr>
          <tr>
            <td class="content" style="padding: 40px; text-align: center;">
              <!-- Main heading -->
              <h1 style="font-size: 28px; font-weight: 400; color: #163029; line-height: 1.2; margin: 0 0 24px 0;">
                ${cleanInviter} has invited you to join the team ${cleanTeamName} as ${formattedRoles}
              </h1>
              
              <!-- Description -->
              <p style="font-size: 14px; color: #78726e; line-height: 1.5; margin: 0 0 32px 0;">
                Gain control and visibility over all AI use in your company. Replace your complex stack with deco CMS, your open-source AI platform.
              </p>
              
              <!-- CTA Button -->
              <center>
                <table cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td style="text-align: center;">
                      <a href="https://admin.decocms.com/invites" class="button" style="display: inline-block; background-color: #d0ec1a; color: #07401a; font-size: 16px; font-weight: 400; text-decoration: none; padding: 18px 32px; border-radius: 16px; min-width: 155px; text-align: center;">
                        Accept invite
                      </a>
                    </td>
                  </tr>
                </table>
              </center>
            </td>
          </tr>
        </table>

        <!-- Spacer -->
        <div style="height: 16px;"></div>

        <!-- Footer -->
        <table style="width: 100%; background-color: #e7e5e4; border-radius: 30px;" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td style="padding: 40px; text-align: center;">
              <a href="https://admin.decocms.com/about" style="color: #000000; font-size: 13px; text-decoration: underline; margin-right: 16px;">About us</a>
              <span style="color: #000000; font-size: 13px;">Made with ❤️ in Brazil</span>
            </td>
          </tr>
        </table>

      </td>
    </tr>
  </table>
  </center>
</body>
</html>
`;
}
