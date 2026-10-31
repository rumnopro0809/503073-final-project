// Read only the delivery state of our own tagged message. Never log credentials or mail content.
export async function traceMailjetDelivery(traceId: string) {
  try {
    const response = await fetch(`https://api.mailjet.com/v3/REST/message?CustomID=${encodeURIComponent(traceId)}&Limit=1`, {
      headers: {Authorization:`Basic ${Buffer.from(`${process.env.SMTP_USER}:${process.env.SMTP_PASS}`).toString('base64')}`},
      signal:AbortSignal.timeout(10_000),
    });
    if (!response.ok) {console.info('MAILJET_TRACE', {traceId,apiStatus:response.status});return;}
    const body = await response.json() as {Data?: {Status?:string}[]};
    const status=body.Data?.[0]?.Status;
    const allowed=['queued','sent','opened','clicked','bounce','bounced','blocked','spam','unsub','deferred','retrying','delivered'];
    console.info('MAILJET_TRACE', {traceId,status:status&&allowed.includes(status.toLowerCase())?status.toLowerCase():status?'unrecognized':'not-indexed-yet'});
  } catch {console.info('MAILJET_TRACE', {traceId,status:'lookup-unavailable'});}
}
