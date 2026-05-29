import { Resend } from "resend";
import config from "~/config";

const resend = new Resend(config.resendKey);

export default resend;
