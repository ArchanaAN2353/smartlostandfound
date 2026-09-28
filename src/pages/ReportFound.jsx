import { useState } from "react";

import { Link } from "react-router-dom";

import {
  ArrowLeft,
  Upload,
  Package,
  Brain,
  ShieldCheck,
} from "lucide-react";

import { supabase } from "../services/supabase";
import { generateImageFingerprint } from "../lib/imageFingerprint";
import SmartMatchLoader from "../components/SmartMatchLoader";

function ReportFound() {
  const [form, setForm] = useState({
    itemName: "",
    description: "",
    location: "",
    foundDate: "",
    foundTime: "",
    characteristics: "",
  });

  /*
   * OWNERSHIP VERIFICATION (MANDATORY)
   *
   * verificationCount decides how many question/answer blocks are
   * rendered. verificationQA always stays in sync with that count.
   */
  const [verificationCount, setVerificationCount] = useState(1);
  const [verificationQA, setVerificationQA] = useState([
    { question: "", answer: "" },
  ]);

  function handleVerificationCountChange(e) {
    const count = Number(e.target.value);
    setVerificationCount(count);

    setVerificationQA((previous) => {
      const next = [...previous];

      while (next.length < count) {
        next.push({ question: "", answer: "" });
      }

      return next.slice(0, count);
    });
  }

  function handleVerificationFieldChange(index, field, value) {
    setVerificationQA((previous) =>
      previous.map((qa, i) =>
        i === index ? { ...qa, [field]: value } : qa
      )
    );
  }

  const [image, setImage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");

  const handleChange = (e) => {
    setForm({
      ...form,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!image) {
      alert("Please upload an item photo.");
      return;
    }

    /*
     * OWNERSHIP VERIFICATION IS MANDATORY
     * Every question and every answer must be filled in before
     * the report can be submitted.
     */
    const incompleteVerification = verificationQA.some(
      (qa) => !qa.question.trim() || !qa.answer.trim()
    );

    if (incompleteVerification) {
      alert(
        "Please fill in every verification question and its answer before submitting."
      );
      return;
    }

    setLoading(true);
    setStatusMessage("Verifying your account...");

    try {
      /* --------------------------------
         1. Get current logged-in user
      -------------------------------- */

      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError) {
        throw sessionError;
      }

      if (!session || !session.user) {
        setLoading(false);

        alert(
          "Your login session has expired. Please login again."
        );

        return;
      }

      const user = session.user;

      console.log("AUTH USER ID:", user.id);
      console.log("AUTH USER EMAIL:", user.email);

      /* --------------------------------
         2. Upload image to Supabase
      -------------------------------- */

      setStatusMessage("Uploading item photo...");

      const fileName = `${Date.now()}-${image.name}`;

      const { error: uploadError } = await supabase.storage
        .from("item-images")
        .upload(fileName, image);

      if (uploadError) {
        throw uploadError;
      }

      /* --------------------------------
         3. Get public image URL
      -------------------------------- */

      setStatusMessage(
        "Preparing image for SmartMatch..."
      );

      const { data: publicUrlData } = supabase.storage
        .from("item-images")
        .getPublicUrl(fileName);

      const imageUrl = publicUrlData.publicUrl;

      console.log(
        "Found item image uploaded:",
        imageUrl
      );

      /* --------------------------------
         4. Generate AI fingerprint
      -------------------------------- */

      setStatusMessage(
        "AI is analyzing the photo..."
      );

      const imageFingerprint =
        await generateImageFingerprint(imageUrl);

      console.log(
        "AI fingerprint generated:",
        imageFingerprint.length
      );

      /* --------------------------------
         5. Save found item
      -------------------------------- */

      setStatusMessage(
        "Saving your found item report..."
      );

      const foundItem = {
        user_id: user.id,
        item_name: form.itemName,
        description: form.description,
        location: form.location,
        found_date: form.foundDate,
        found_time: form.foundTime,
        characteristics: form.characteristics,
        image_url: imageUrl,
        image_fingerprint: imageFingerprint,
        status: "found",
        claim_status: "available",

        /*
         * OWNERSHIP VERIFICATION (mandatory)
         *
         * verification_questions: array of question strings — safe
         * to show to anyone trying to claim the item.
         * verification_answers: array of answer strings, in the
         * SAME order — must stay private to the founder. Never
         * select this column on any claimant-facing screen.
         */
        verification_questions: verificationQA.map((qa) =>
          qa.question.trim()
        ),
        verification_answers: verificationQA.map((qa) =>
          qa.answer.trim()
        ),
      };

      console.log(
        "Saving found item:",
        foundItem
      );

      /*
       * IMPORTANT:
       * Do not use .select() here.
       * This avoids triggering SELECT RLS
       * immediately after the INSERT.
       */

      const { error: insertError } = await supabase
        .from("found_items")
        .insert([foundItem]);

      if (insertError) {
        console.error(
          "DATABASE INSERT ERROR:",
          insertError
        );

        throw insertError;
      }

      console.log(
        "FOUND ITEM SAVED SUCCESSFULLY"
      );

      /* --------------------------------
         6. Success
      -------------------------------- */

      setStatusMessage(
        "Found item submitted successfully!"
      );

      await new Promise((resolve) =>
        setTimeout(resolve, 700)
      );

      alert(
        "Found item submitted successfully!\nAI photo fingerprint generated."
      );

      setForm({
        itemName: "",
        description: "",
        location: "",
        foundDate: "",
        foundTime: "",
        characteristics: "",
      });

      setVerificationCount(1);
      setVerificationQA([{ question: "", answer: "" }]);

      setImage(null);

      setStatusMessage("");

      const fileInput =
        document.getElementById("found-image");

      if (fileInput) {
        fileInput.value = "";
      }

    } catch (error) {
      console.error(
        "Found item submission error:",
        error
      );

      setStatusMessage("");

      alert(
        `Something went wrong.\n\n${
          error.message || "Please try again."
        }`
      );

    } finally {
      setLoading(false);
    }
  };

  /* --------------------------------
     SmartMatch loading screen
  -------------------------------- */

  if (loading) {
    return (
      <SmartMatchLoader
        text={
          statusMessage ||
          "Processing your found item..."
        }
      />
    );
  }

  return (
    <div className="form-page">
      <div className="form-container">

        <Link
          to="/"
          className="back-link"
        >
          <ArrowLeft size={18} />
          Back to Home
        </Link>

        <div className="form-header">

          <div className="form-icon">
            <Package size={26} />
          </div>

          <p className="eyebrow">
            REPORT FOUND ITEM
          </p>

          <h1>
            What did you find?
          </h1>

          <p>
            Tell us about the item you found so our
            matching system can help locate its owner.
          </p>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              marginTop: "16px",
              padding: "10px 14px",
              borderRadius: "10px",
              background: "#f3f4f6",
              fontSize: "13px",
            }}
          >
            <Brain size={17} />

            <span>
              AI Photo Fingerprint enabled
            </span>
          </div>

        </div>

        <form onSubmit={handleSubmit}>

          {/* IMAGE */}

          <div className="form-group">

            <label>
              Item Photo
            </label>

            <label
              htmlFor="found-image"
              className="upload-box"
            >
              <Upload size={28} />

              <span>
                {image
                  ? image.name
                  : "Click to upload a photo"}
              </span>

              <small>
                PNG, JPG or JPEG
              </small>

            </label>

            <input
              id="found-image"
              type="file"
              accept="image/*"
              onChange={(e) =>
                setImage(e.target.files[0])
              }
              hidden
            />

          </div>

          {/* ITEM NAME */}

          <div className="form-group">

            <label>
              Item Name
            </label>

            <input
              type="text"
              name="itemName"
              placeholder="e.g. Black AirPods"
              value={form.itemName}
              onChange={handleChange}
              required
            />

          </div>

          {/* DESCRIPTION */}

          <div className="form-group">

            <label>
              Description
            </label>

            <textarea
              name="description"
              placeholder="Describe the item you found..."
              value={form.description}
              onChange={handleChange}
              required
            />

          </div>

          {/* LOCATION */}

          <div className="form-group">

            <label>
              Where did you find it?
            </label>

            <input
              type="text"
              name="location"
              placeholder="e.g. MSRIT Library"
              value={form.location}
              onChange={handleChange}
              required
            />

          </div>

          {/* DATE + TIME */}

          <div className="form-row">

            <div className="form-group">

              <label>
                Date
              </label>

              <input
                type="date"
                name="foundDate"
                value={form.foundDate}
                onChange={handleChange}
                required
              />

            </div>

            <div className="form-group">

              <label>
                Approximate Time
              </label>

              <input
                type="time"
                name="foundTime"
                value={form.foundTime}
                onChange={handleChange}
                required
              />

            </div>

          </div>

          {/* CHARACTERISTICS */}

          <div className="form-group">

            <label>
              Identifying Characteristics
            </label>

            <textarea
              name="characteristics"
              placeholder="Scratches, stickers, unique marks, color, etc."
              value={form.characteristics}
              onChange={handleChange}
            />

          </div>

          {/* OWNERSHIP VERIFICATION (MANDATORY) */}

          <div
            className="form-group"
            style={{
              padding: "16px",
              borderRadius: "12px",
              border: "1px dashed rgba(91, 76, 58, 0.3)",
            }}
          >
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <ShieldCheck size={16} />
              Set verification questions (required)
            </label>

            <p
              style={{
                fontSize: "12px",
                color: "#71685b",
                margin: "4px 0 16px",
                lineHeight: 1.5,
              }}
            >
              Ask something only the real owner would know — e.g.
              "What's the lock screen wallpaper?" or "How many keys
              are on the keychain?". Whoever claims this item must
              answer every question correctly before you verify
              them.
            </p>

            <div style={{ marginBottom: "18px" }}>
              <label style={{ marginBottom: "6px" }}>
                How many questions do you want to add?
              </label>

              <select
                value={verificationCount}
                onChange={handleVerificationCountChange}
              >
                {[1, 2, 3, 4, 5].map((n) => (
                  <option key={n} value={n}>
                    {n} question{n > 1 ? "s" : ""}
                  </option>
                ))}
              </select>
            </div>

            {verificationQA.map((qa, index) => (
              <div
                key={index}
                style={{
                  marginBottom:
                    index === verificationQA.length - 1 ? 0 : "16px",
                  paddingBottom:
                    index === verificationQA.length - 1 ? 0 : "16px",
                  borderBottom:
                    index === verificationQA.length - 1
                      ? "none"
                      : "1px solid rgba(91, 76, 58, 0.15)",
                }}
              >
                <label
                  style={{
                    fontSize: "11px",
                    marginBottom: "6px",
                    color: "#8b4d32",
                  }}
                >
                  QUESTION {index + 1}
                </label>

                <input
                  type="text"
                  placeholder="e.g. What sticker is on the laptop lid?"
                  value={qa.question}
                  onChange={(e) =>
                    handleVerificationFieldChange(
                      index,
                      "question",
                      e.target.value
                    )
                  }
                  required
                  style={{ marginBottom: "10px" }}
                />

                <input
                  type="text"
                  placeholder="The correct answer (only you will see this)"
                  value={qa.answer}
                  onChange={(e) =>
                    handleVerificationFieldChange(
                      index,
                      "answer",
                      e.target.value
                    )
                  }
                  required
                />
              </div>
            ))}
          </div>

          {/* AI STATUS */}

          {statusMessage && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                marginBottom: "16px",
                padding: "12px 14px",
                borderRadius: "10px",
                background: "#f3f4f6",
                fontSize: "14px",
              }}
            >

              <Brain size={18} />

              <span>
                {statusMessage}
              </span>

            </div>
          )}

          {/* SUBMIT */}

          <button
            type="submit"
            className="submit-button"
            disabled={loading}
          >
            {loading
              ? statusMessage || "Processing..."
              : "Find Owner"}
          </button>

        </form>

      </div>
    </div>
  );
}

export default ReportFound;