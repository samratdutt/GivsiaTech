import mongoose from "mongoose";

// Singleton document — there is only ever one CompanyInfo record, fetched
// with findOne() and updated in place. Backs both the "About" section copy
// and Givi's chat grounding for "tell me about your company" questions.
const companyInfoSchema = new mongoose.Schema(
  {
    heading: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    stats: {
      type: [{ value: { type: String, trim: true }, label: { type: String, trim: true } }],
      default: [],
    },
  },
  { timestamps: true }
);

export default mongoose.model("CompanyInfo", companyInfoSchema);
